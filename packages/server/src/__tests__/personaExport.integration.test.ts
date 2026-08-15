import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { userPersonaAnswers, userPersonaText } from '@commonpub/schema';
import type { PersonaSection } from '@commonpub/persona';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { exportUserData, type UserDataExport } from '../profile/export.js';
import { currentPurposeScope, recordPurposeConsent } from '../persona/consent.js';
import { setStatisticsObjection } from '../persona/objections.js';
import type { PurposeScopeConfig } from '../persona/consent.js';

// Plan section 6.11 (the DSAR gains persona) and section 10.4 (the parity guard).

/** The instance that actually discloses to somebody, so a purpose is offerable. */
const SHARING_CONFIG = {
  dataSharing: {
    recipients: [
      {
        id: 'contoso',
        name: 'Contoso Tools',
        privacyPolicyUrl: 'https://contoso.example/privacy',
        purposes: ['sponsor_sharing'],
        relationship: 'processor',
      },
    ],
  },
} as PurposeScopeConfig;

const SECTIONS: PersonaSection[] = [
  {
    key: 'interests',
    label: 'Interests',
    fields: [
      {
        key: 'interests',
        label: 'What are you into?',
        type: 'multiselect',
        options: [
          { value: 'robotics', label: 'Robotics' },
          { value: 'pcb', label: 'PCB design' },
        ],
      },
    ],
  },
  {
    key: 'about',
    label: 'About',
    fields: [{ key: 'why_making', label: 'Why do you make things?', type: 'textarea' }],
  },
];

describe('exportUserData persona sections (plan section 6.11)', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: `persona-export-${Date.now()}` })).id;

    await db.insert(userPersonaAnswers).values([
      { userId, sectionKey: 'interests', fieldKey: 'interests', value: 'robotics' },
      { userId, sectionKey: 'interests', fieldKey: 'interests', value: 'pcb' },
      // A field the operator has since removed from the schema: its key resolves
      // to no label at all, which is exactly the case section 6.11 exists for.
      { userId, sectionKey: 'retired', fieldKey: 'retired_field', value: 'retired_value' },
    ]);
    await db.insert(userPersonaText).values({
      userId,
      sectionKey: 'about',
      fieldKey: 'why_making',
      value: 'Because taking things apart is how I learned to read.',
    });

    // A purpose can only be granted where it is OFFERABLE, and both surviving
    // purposes require a declared, papered recipient, so the fixture has to
    // name one. `currentPurposeScope(db, {})` on a default instance now offers
    // nothing at all, which is the makerspace case rather than a broken setup.
    const scope = await currentPurposeScope(db, SHARING_CONFIG);
    await recordPurposeConsent(db, {
      userId, purpose: 'sponsor_sharing', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
      ip: '198.51.100.7', userAgent: 'TestAgent/1.0',
    });
    await recordPurposeConsent(db, {
      userId, purpose: 'sponsor_sharing', grant: false,
      scopeDigest: scope.digest, scope, source: 'settings',
    });

    // The Art. 21 objection is a different instrument in a different table, and
    // the export has to carry it: see the parity guard below.
    await setStatisticsObjection(db, userId, true);
  });

  afterAll(async () => { await closeTestDB(db); });

  it('exports every persona section as an array', async () => {
    const data = await exportUserData(db, userId);
    for (const key of [
      'personaAnswers',
      'personaText',
      'purposeConsents',
      'statisticsObjections',
      'sharedLinks',
    ] as const) {
      expect(Array.isArray(data[key]), `${key} should be an array`).toBe(true);
    }
    expect(data.personaAnswers).toHaveLength(3);
    expect(data.personaText).toHaveLength(1);
  });

  it('exports the Art. 21 objection, because a right exercised is a fact held', async () => {
    const data = await exportUserData(db, userId);
    expect(data.statisticsObjections).toHaveLength(1);
    expect(data.statisticsObjections[0]!.objectedAt).toBeTruthy();
  });

  it('exports shared link platforms as an array, empty when nothing is shared', async () => {
    // Row-present-means-shared, so an empty array is a COMPLETE answer and not
    // a missing section. This subject has shared nothing.
    const data = await exportUserData(db, userId);
    expect(data.sharedLinks).toEqual([]);
  });

  it('emits the RAW keys and the stored value with or without a resolvable label', async () => {
    const withoutLabels = await exportUserData(db, userId);
    for (const row of withoutLabels.personaAnswers) {
      expect(row.fieldKey).toBeTruthy();
      expect(row.sectionKey).toBeTruthy();
      expect(row.value).toBeTruthy();
      expect(row.fieldLabel).toBeNull();
      expect(row.valueLabel).toBeNull();
    }
    expect(withoutLabels.personaText[0]!.value)
      .toContain('taking things apart');
  });

  it('resolves labels when the effective schema is supplied, and keeps the raw keys', async () => {
    const data = await exportUserData(db, userId, { personaSections: SECTIONS });

    const robotics = data.personaAnswers.find((r) => r.value === 'robotics');
    expect(robotics).toBeDefined();
    expect(robotics!.fieldKey).toBe('interests');
    expect(robotics!.sectionLabel).toBe('Interests');
    expect(robotics!.fieldLabel).toBe('What are you into?');
    expect(robotics!.valueLabel).toBe('Robotics');

    const text = data.personaText[0]!;
    expect(text.fieldKey).toBe('why_making');
    expect(text.fieldLabel).toBe('Why do you make things?');
    expect(text.sectionLabel).toBe('About');
  });

  it('a retired field is never invisible: raw key and value survive with null labels', async () => {
    const data = await exportUserData(db, userId, { personaSections: SECTIONS });
    const retired = data.personaAnswers.find((r) => r.fieldKey === 'retired_field');
    expect(retired).toBeDefined();
    expect(retired!.value).toBe('retired_value');
    expect(retired!.sectionKey).toBe('retired');
    expect(retired!.sectionLabel).toBeNull();
    expect(retired!.fieldLabel).toBeNull();
    expect(retired!.valueLabel).toBeNull();
  });

  it('exports the FULL purpose-consent history, superseded rows included', async () => {
    const data = await exportUserData(db, userId);
    expect(data.purposeConsents).toHaveLength(2);
    const states = data.purposeConsents.map((r) => r.state).sort();
    expect(states).toEqual(['granted', 'revoked']);

    const granted = data.purposeConsents.find((r) => r.state === 'granted')!;
    expect(granted.purpose).toBe('sponsor_sharing');
    expect(granted.policyVersion).toBeTruthy();
    expect(granted.scopeDigest).toBeTruthy();
    expect(granted.ipAddress).toBe('198.51.100.7');
    expect(granted.userAgent).toBe('TestAgent/1.0');
    // The snapshot of what was shown is the Art. 7(1) answer to "what did I
    // agree to", and it is why no `sharing:*` row is written to user_consents.
    const snapshot = granted.scopeSnapshot as { purposeLabel: string; onSummary: string };
    expect(snapshot.purposeLabel).toBeTruthy();
    expect(snapshot.onSummary).toBeTruthy();
    // Exactly one of the two rows is still current.
    expect(data.purposeConsents.filter((r) => r.supersededAt === null)).toHaveLength(1);
  });

  it('still exports the profile links, which the deferred cutover leaves in place', async () => {
    const data = await exportUserData(db, userId);
    // Section 14.4 defers the `user_profile_links` normalization, so removing
    // these from the profile allow-list would drop the only copy of the data.
    expect(Object.keys(data.profile)).toContain('socialLinks');
    expect(Object.keys(data.profile)).toContain('website');
  });
});

describe('DSAR parity guard: every persona table with a user_id is exported (plan section 10.4)', () => {
  let db: DB;
  let data: UserDataExport;

  beforeAll(async () => {
    db = await createTestDB();
    const userId = (await createTestUser(db, { username: `parity-${Date.now()}` })).id;
    data = await exportUserData(db, userId);
  });
  afterAll(async () => { await closeTestDB(db); });

  /** `user_persona_answers` -> `personaAnswers`, `user_purpose_consents` -> `purposeConsents`. */
  function exportKeyFor(tableName: string): string {
    return tableName
      .replace(/^user_/, '')
      .split('_')
      .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
  }

  it('walks the persona table module and finds every user-scoped table in the export', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../schema/src/persona.ts', import.meta.url)),
      'utf8',
    );
    // GUARD (P7): a broken path reads an empty file, every loop below runs zero
    // times, and the test passes green while checking nothing.
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toContain('user_purpose_consents');

    // Split on the table declarations so each chunk is one table's definition.
    const chunks = source.split(/pgTable\(/).slice(1);
    expect(chunks.length).toBeGreaterThanOrEqual(4);

    const userScoped: string[] = [];
    for (const chunk of chunks) {
      const name = /^\s*'([a-z_]+)'/.exec(chunk)?.[1];
      expect(name, 'every pgTable call names its table').toBeTruthy();
      // Only the column definition matters, i.e. everything up to the index list.
      const body = chunk.split('}, (t) =>')[0] ?? chunk;
      if (/uuid\('user_id'\)/.test(body)) userScoped.push(name!);
    }

    // FLOOR: three of the four tables carry user_id (persona_metrics_daily is a
    // rollup and carries none). Fewer than three means the walk broke.
    expect(userScoped.length).toBeGreaterThanOrEqual(3);
    expect(userScoped).toEqual(
      expect.arrayContaining(['user_persona_answers', 'user_persona_text', 'user_purpose_consents']),
    );

    for (const table of userScoped) {
      const key = exportKeyFor(table);
      expect(Object.keys(data), `${table} must be exported as "${key}"`).toContain(key);
      expect(Array.isArray((data as unknown as Record<string, unknown>)[key])).toBe(true);
    }

    // The rollup table is deliberately NOT exported: it holds no user rows.
    expect(userScoped).not.toContain('persona_metrics_daily');
  });
});
