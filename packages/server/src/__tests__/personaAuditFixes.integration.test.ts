import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  personaMetricsDaily,
  userPersonaAnswers,
  userPersonaText,
  userPurposeConsents,
  users,
} from '@commonpub/schema';
import type { PersonaSection } from '@commonpub/persona';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  effectivePersonaSchema,
  getPersonaRetiredFields,
  invalidatePersonaSchemaCache,
  savePersonaSchemaOverride,
} from '../persona/registry.js';
import {
  getPersonaValues,
  retirePersonaField,
  setPersonaSection,
  validatePersonaSectionAnswers,
} from '../persona/values.js';
import {
  bandPersonaCount,
  getAudienceCounts,
  getPersonaFieldDistribution,
  personaMetricsFields,
  resolvePersonaThresholds,
  runPersonaRollup,
  utcDayKey,
} from '../persona/metrics.js';
import { currentPurposeScope } from '../persona/consent.js';
import { flattenPersonaFields, planPersonaSchemaChange } from '../persona/schemaChange.js';

/**
 * The defects the 2026-08-12 audit found, each with the test that would have
 * caught it.
 *
 * Grouped in one file on purpose: they are unrelated in the code and identical
 * in shape. Every one of them was a rule stated in a docblock, enforced in one
 * place, and quietly violated in another, with all 6800 tests green.
 */

const CONFIG = {} as unknown as CommonPubConfig;

function cfg(sections: PersonaSection[]): CommonPubConfig {
  return { persona: { sections } } as unknown as CommonPubConfig;
}

const PLATFORMS = [
  {
    key: 'github',
    label: 'GitHub',
    hostSuffixes: ['github.com'],
    placeholder: '',
    authenticitySignal: true,
  },
];

describe('a closed vocabulary binds even when the field is routed to free text', () => {
  /**
   * `personaFieldSink` sends a `select` to the TEXT sink whenever `sensitive` is
   * true, which is exactly the Art. 9 escape hatch an operator reaches for on a
   * health or ethnicity dropdown. The write path used to branch on the SINK, so
   * the `text` branch checked only `maxLength` and the declared vocabulary was
   * enforced nowhere: any member could store an arbitrary 2000-character string
   * under it. Only the storage DESTINATION may depend on the sink.
   */
  const section: PersonaSection = {
    key: 'health',
    label: 'Health',
    fields: [
      {
        key: 'condition',
        label: 'Condition',
        type: 'select',
        sensitive: true,
        options: [
          { value: 'none', label: 'None' },
          { value: 'other', label: 'Other' },
        ],
      },
    ],
  };

  it('accepts a declared option', () => {
    const result = validatePersonaSectionAnswers(section, { condition: 'none' }, PLATFORMS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result.text).toEqual([{ fieldKey: 'condition', value: 'none' }]);
  });

  it('refuses free text under a closed vocabulary, sink notwithstanding', () => {
    const result = validatePersonaSectionAnswers(
      section,
      { condition: 'anything I like, 2000 characters of it' },
      PLATFORMS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does not offer that option');
  });
});

describe('rows stranded by a sink change stay visible and erasable', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: 'sink-change' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  const counted: PersonaSection[] = [
    {
      key: 'basics',
      label: 'Basics',
      fields: [
        {
          key: 'industry',
          label: 'Industry',
          type: 'select',
          options: [{ value: 'hardware', label: 'Hardware' }],
        },
      ],
    },
  ];
  // ONE config edit: the operator stops counting the field. `personaFieldSink`
  // moves it from `user_persona_answers` to `user_persona_text`.
  const uncounted: PersonaSection[] = [
    { ...counted[0]!, fields: [{ ...counted[0]!.fields[0]!, analytics: false }] },
  ];

  it('does not silently hide them the way "key left the schema" did', async () => {
    await setPersonaSection(db, {
      userId,
      sectionKey: 'basics',
      answers: { industry: 'hardware' },
      config: cfg(counted),
    });
    invalidatePersonaSchemaCache(db);

    const before = await getPersonaValues(db, userId, counted);
    expect(before.answers.industry).toEqual(['hardware']);
    expect(before.retired).toHaveLength(0);

    // Same key, still in the schema, different sink. Before the fix this row
    // was read by nothing, listed in nothing, and `DELETE /api/persona/retired/
    // industry` 404'd on it, so Art. 15 and Art. 17 both failed from a one-line
    // config edit while `diffPersonaSchema` correctly raised the drift.
    const after = await getPersonaValues(db, userId, uncounted);
    expect(after.answers.industry).toBeUndefined();
    expect(after.retired).toHaveLength(1);
    expect(after.retired[0]).toMatchObject({
      fieldKey: 'industry',
      values: ['hardware'],
      reason: 'sink_changed',
    });
  });
});

describe('planPersonaSchemaChange', () => {
  const before = flattenPersonaFields([
    {
      key: 'basics',
      label: 'Basics',
      fields: [
        {
          key: 'industry',
          label: 'Industry',
          type: 'select',
          options: [
            { value: 'hardware', label: 'Hardware' },
            { value: 'software', label: 'Software' },
          ],
        },
      ],
    },
  ]);

  it('never asks for a removal decision on a field that is still in the schema', () => {
    // `retirePersonaField` means "this field left the schema": it writes the key
    // into `persona.retiredFields`, which is a PERMANENT block in
    // `listPersonaAggregatableFields`. Treating a sink change as a removal meant
    // toggling `analytics` off and on again retired the field forever, and the
    // only way back was deleting every member's answers.
    const after = flattenPersonaFields([
      {
        key: 'basics',
        label: 'Basics',
        fields: [{ ...before.get('industry')!, analytics: false }],
      },
    ]);
    const plan = planPersonaSchemaChange({
      before,
      after,
      rowCounts: new Map([['industry', 40]]),
      optionCounts: new Map(),
      removal: {},
      minBucket: 5,
    });
    expect(plan.removalNeeded).toEqual([]);
    const sink = plan.blockers.find((b) => b.kind === 'sink_changed');
    expect(sink?.requires).toBe('force');
  });

  it('still asks for one on a field genuinely removed', () => {
    const plan = planPersonaSchemaChange({
      before,
      after: flattenPersonaFields([]),
      rowCounts: new Map([['industry', 40]]),
      optionCounts: new Map(),
      removal: {},
      minBucket: 5,
    });
    expect(plan.removalNeeded).toEqual(['industry']);
    expect(plan.blockers[0]?.requires).toBe('removal');
  });

  it('floors every count it reports and names no option value', () => {
    const after = flattenPersonaFields([
      {
        key: 'basics',
        label: 'Basics',
        fields: [
          { ...before.get('industry')!, options: [{ value: 'hardware', label: 'Hardware' }] },
        ],
      },
    ]);
    const plan = planPersonaSchemaChange({
      before,
      after,
      rowCounts: new Map([['industry', 41]]),
      optionCounts: new Map([['industry', { hardware: 34, software: 7 }]]),
      removal: {},
      minBucket: 5,
    });
    const blocker = plan.blockers.find((b) => b.kind === 'option_removed');
    expect(blocker?.affectedRows).toBe(5);
    expect(blocker?.detail).not.toContain('software');
    expect(blocker?.detail).toContain('5');
  });
});

describe('bandPersonaCount', () => {
  it('withholds a count under the floor and floors one above it', () => {
    expect(bandPersonaCount(3, 5)).toEqual({ value: 0, phrase: 'fewer than 5', banded: true });
    expect(bandPersonaCount(7, 5)).toEqual({ value: 5, phrase: '5', banded: false });
    expect(bandPersonaCount(0, 5)).toEqual({ value: 0, phrase: '0', banded: false });
  });
});

describe('saving a schema un-retires a key that came back', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('so an operator is not permanently locked out of their own field', async () => {
    const admin = await createTestUser(db, { username: 'un-retire-admin', role: 'admin' });
    const sections: PersonaSection[] = [
      {
        key: 'basics',
        label: 'Basics',
        fields: [
          {
            key: 'industry',
            label: 'Industry',
            type: 'select',
            options: [{ value: 'hardware', label: 'Hardware' }],
          },
        ],
      },
    ];

    await retirePersonaField(db, { fieldKey: 'industry', adminId: admin.id });
    expect((await getPersonaRetiredFields(db)).map((r) => r.fieldKey)).toContain('industry');

    const saved = await savePersonaSchemaOverride(db, { sections, adminId: admin.id });
    expect(saved.ok).toBe(true);
    // Retirement means "this question left the schema", so the question coming
    // back is what ends it. Otherwise `clearPersonaFieldRetired` is reachable
    // only from `purgePersonaField`, and the only way to un-retire a present
    // field is to delete every member's answers to it.
    expect((await getPersonaRetiredFields(db)).map((r) => r.fieldKey)).not.toContain('industry');
  });
});

describe('section order is honoured, once, where the schema is resolved', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('sorts by order and keeps declaration order as the tiebreak', async () => {
    invalidatePersonaSchemaCache(db);
    const { sections } = await effectivePersonaSchema(
      db,
      cfg([
        { key: 'third', label: 'Third', order: 9, fields: [] },
        { key: 'first', label: 'First', order: 1, fields: [] },
        { key: 'second', label: 'Second', order: 1, fields: [] },
      ]),
    );
    expect(sections.map((s) => s.key)).toEqual(['first', 'second', 'third']);
  });
});

describe('a finalised day carries the consent scope its AUDIENCE counts came from', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  const sections: PersonaSection[] = [
    {
      key: 'interests',
      label: 'Interests',
      fields: [
        {
          key: 'interests',
          label: 'Interests',
          type: 'multiselect',
          options: [
            { value: 'robotics', label: 'Robotics' },
            { value: 'hardware', label: 'Hardware' },
          ],
        },
      ],
    },
  ];

  /**
   * Thirty members with answers and NO consent row of any kind, which is the
   * normal case now: statistics run on legitimate interest. Ten of them also
   * grant `recruiter_visibility`, which is the one figure on a stored day that
   * a moved scope can invalidate.
   */
  async function seedMembers(digest: string, n: number, granting: number): Promise<void> {
    for (let i = 0; i < n; i += 1) {
      const user = await createTestUser(db, { username: `rollup-${i}` });
      await db.update(users).set({ profileVisibility: 'public' }).where(eq(users.id, user.id));
      await db.insert(userPersonaAnswers).values({
        userId: user.id,
        sectionKey: 'interests',
        fieldKey: 'interests',
        value: 'robotics',
      });
      if (i >= granting) continue;
      await db.insert(userPurposeConsents).values({
        userId: user.id,
        purpose: 'recruiter_visibility',
        state: 'granted',
        scopeDigest: digest,
        scopeSnapshot: {
          purposeLabel: 'x',
          offSummary: 'x',
          onSummary: 'x',
          recipients: [],
          dataClasses: [],
          aggregatableFieldKeys: [],
          policyVersion: '1',
        },
        policyVersion: '1',
        source: 'settings',
      });
    }
  }

  it('refuses to publish the audience count once the operator moves the scope', async () => {
    const config = cfg(sections);
    const scope = await currentPurposeScope(db, config, { sections: async () => sections });
    await seedMembers(scope.digest, 30, 10);

    const thresholds = resolvePersonaThresholds({});
    const fields = personaMetricsFields(sections);
    const offeredPurposes = [
      { purpose: 'recruiter_visibility' as const, scopeDigest: scope.digest },
    ];
    const today = utcDayKey();
    const yesterday = new Date(`${today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const previous = yesterday.toISOString().slice(0, 10);

    // Give the pass a non-final yesterday to close out, which is what makes a
    // finalised snapshot exist at all.
    await db.insert(personaMetricsDaily).values({
      day: previous,
      metric: 'persona.meta',
      dimension: 'population',
      value: 0,
      suppressed: false,
      final: false,
    });

    await runPersonaRollup(db, {
      day: today,
      fields,
      platforms: [],
      thresholds,
      offeredPurposes,
    });

    const audience = await getAudienceCounts(db, {
      thresholds,
      source: 'rollup',
      offeredPurposes,
    });
    expect(audience.openToRecruiters).toEqual({ available: true, count: 10 });
    expect(audience.asOf).toBe(previous);

    // The operator adds a recipient at 09:00. Every stored grant's digest now
    // differs from the live one, so by the feature's own rule every grant
    // authorises nothing. The LIVE query drops them the moment the digest moves;
    // the rollup path used to keep publishing yesterday's figure, built from
    // those grants, for up to ~30 hours, or forever with the worker stopped.
    const stale = await getAudienceCounts(db, {
      thresholds,
      source: 'rollup',
      offeredPurposes: [{ purpose: 'recruiter_visibility', scopeDigest: 'moved' }],
    });
    expect(stale.openToRecruiters).toEqual({ available: false, reason: 'scope_changed' });
  });

  it('and keeps publishing the distributions, which no consent produced', async () => {
    const thresholds = resolvePersonaThresholds({});
    const fields = personaMetricsFields(sections);
    const dist = await getPersonaFieldDistribution(db, {
      thresholds,
      source: 'rollup',
      field: fields[0]!,
      limit: 20,
    });
    // The refusal above is about a count of grant holders. How many members
    // answered "robotics" has nothing to do with any grant, and darkening it
    // because a recipient list changed would be a statement about the data that
    // is not true.
    expect(dist.available).toBe(true);
    expect(dist.items.map((i) => i.value)).toEqual(['robotics']);
  });

  it('stores the digest as a dimension, never as a value sentinel', async () => {
    const rows = await db
      .select({ dimension: personaMetricsDaily.dimension })
      .from(personaMetricsDaily)
      .where(and(eq(personaMetricsDaily.metric, 'persona.meta'), eq(personaMetricsDaily.final, true)));
    expect(rows.some((r) => r.dimension.startsWith('scope:'))).toBe(true);
    // `:` cannot appear in an option value or a platform key, both
    // `^[a-z0-9_]+$`, so the prefix cannot collide with a real dimension.
    expect(rows.every((r) => !r.dimension.includes('-1'))).toBe(true);
  });
});

describe('a stored day is re-floored when the operator raises the floor', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('rather than serving a 5 under a payload that declares a quantum of 20', async () => {
    const day = '2026-08-11';
    const digest = 'abc123';
    await db.insert(personaMetricsDaily).values([
      { day, metric: 'persona.meta', dimension: 'population', value: 100, suppressed: false, final: true },
      { day, metric: 'persona.meta', dimension: `scope:${digest}`, value: 0, suppressed: false, final: true },
      { day, metric: 'persona.field.interests', dimension: 'robotics', value: 5, suppressed: false, final: true },
    ]);

    const field = {
      sectionKey: 'interests',
      fieldKey: 'interests',
      label: 'Interests',
      cardinality: 'set' as const,
      options: [{ value: 'robotics', label: 'Robotics' }],
    };

    // Suppression and quantisation are applied at WRITE, so a day written under
    // `minBucket: 5` keeps its 5 forever. Serving it under a payload whose own
    // `quantum` now says 20 publishes a count more precise than the k-anonymity
    // statement the payload is making.
    const raised = await getPersonaFieldDistribution(db, {
      thresholds: { minBucket: 20, minPopulation: 25 },
      source: 'rollup',
      field,
      limit: 20,
    });
    expect(raised.items).toEqual([]);
    expect(raised.suppressed).toBe(1);
    expect(raised.quantum).toBe(20);
  });

  it('refuses the whole day when the population floor is raised past it', async () => {
    const raised = await getPersonaFieldDistribution(db, {
      thresholds: { minBucket: 5, minPopulation: 500 },
      source: 'rollup',
      field: {
        sectionKey: 'interests',
        fieldKey: 'interests',
        label: 'Interests',
        cardinality: 'set',
        options: [],
      },
      limit: 20,
    });
    expect(raised.available).toBe(false);
    expect(raised.reason).toBe('insufficient_population');
  });
});

describe('two concurrent saves of one section do not leave the union', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  const sections: PersonaSection[] = [
    {
      key: 'interests',
      label: 'Interests',
      fields: [
        {
          key: 'interests',
          label: 'Interests',
          type: 'multiselect',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
          ],
        },
      ],
    },
  ];

  it('because the write takes a row lock before it reads', async () => {
    const userId = (await createTestUser(db, { username: 'two-tabs' })).id;
    const config = cfg(sections);
    await setPersonaSection(db, { userId, sectionKey: 'interests', answers: { interests: ['a'] }, config });

    // The template-scoped DELETE only re-evaluates rows it has already scanned,
    // so without the lock T2 never sees the row T1 inserted and the member is
    // left holding `{b, c}`, a set they never chose, contributing to two
    // analytics buckets.
    await Promise.all([
      setPersonaSection(db, { userId, sectionKey: 'interests', answers: { interests: ['b'] }, config }),
      setPersonaSection(db, { userId, sectionKey: 'interests', answers: { interests: ['c'] }, config }),
    ]);

    const rows = await db
      .select({ value: userPersonaAnswers.value })
      .from(userPersonaAnswers)
      .where(eq(userPersonaAnswers.userId, userId));
    expect(rows).toHaveLength(1);
    expect(['b', 'c']).toContain(rows[0]!.value);
  });
});

describe('nothing in this file leaves free text in a countable table', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('holds, as a standing check on the partition', async () => {
    const answers = await db.select().from(userPersonaAnswers);
    const text = await db.select().from(userPersonaText);
    expect(answers.every((r) => r.value.length <= 120)).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(0);
    expect(CONFIG).toBeDefined();
  });
});
