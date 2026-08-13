import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import {
  users,
  userPersonaAnswers,
  userPersonaText,
  userPurposeConsents,
  personaMetricsDaily,
} from '@commonpub/schema';
import type { PurposeScopeSnapshot } from '@commonpub/schema';
import {
  METRICS_MIN_BUCKET,
  MIN_AUDIENCE_POPULATION,
  BUILTIN_PERSONA_LINK_PLATFORMS,
  purposeScopeDigest,
} from '@commonpub/persona';
import type { PersonaSection, ProcessingPurposeId } from '@commonpub/persona';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import {
  getAudienceCounts,
  getPersonaFieldDistribution,
  getPersonaLinkPresence,
  latestFinalisedSnapshot,
  personaMetricsFields,
  quantisePersonaCount,
  resolvePersonaThresholds,
  runPersonaRollup,
  previousUtcDay,
  PERSONA_SUPPRESSED_DIMENSION,
  personaFieldMetric,
  type PersonaMetricsField,
} from '../persona/metrics.js';

/**
 * Plan 10.3, minus the two rows section 14.4 defers (`api_keys.purposes`
 * differentiation, and the `/metrics/timeseries` persona back door, which cannot
 * exist because persona writes to its own table).
 *
 * Every case here is an ABSENCE case or a SUPPRESSION case: the interesting
 * property of this layer is what it refuses to publish, so a test that only
 * proved the happy path would prove almost nothing.
 */

// --- The template under test ----------------------------------------------------

const INDUSTRY_OPTIONS = [
  { value: 'software', label: 'Software' },
  { value: 'aerospace', label: 'Aerospace' },
];

const INTEREST_OPTIONS = [
  { value: 'rust', label: 'Rust' },
  { value: 'niche', label: 'Niche thing' },
];

const SECTIONS: PersonaSection[] = [
  {
    key: 'work',
    label: 'Work',
    fields: [
      { key: 'industry', label: 'Industry', type: 'select', options: INDUSTRY_OPTIONS },
      { key: 'sector', label: 'Sector', type: 'select', options: INDUSTRY_OPTIONS },
      // Free text: never countable, and the table it lives in is not imported by
      // the analytics module at all.
      { key: 'about_me', label: 'About you', type: 'textarea', maxLength: 500 },
      // Art. 9 escape hatch: a closed vocabulary forced out of the countable
      // partition by the operator.
      {
        key: 'health',
        label: 'Health',
        type: 'select',
        options: INDUSTRY_OPTIONS,
        sensitive: true,
      },
      { key: 'link_github', label: 'GitHub', type: 'link', platform: 'github' },
    ],
  },
  {
    key: 'interests',
    label: 'Interests',
    fields: [
      { key: 'interests', label: 'Interests', type: 'multiselect', options: INTEREST_OPTIONS },
    ],
  },
];

const AGGREGATABLE_KEYS = ['industry', 'sector', 'interests'];

const ANALYTICS_DIGEST = purposeScopeDigest({
  policyVersion: '1',
  dataClasses: ['persona_selections'],
  recipientIds: [],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
});

const RECRUITER_DIGEST = purposeScopeDigest({
  policyVersion: '1',
  dataClasses: ['persona_selections', 'public_identity'],
  recipientIds: ['acme'],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
});

/** A grant carrying this authorises nothing: the policy version moved on. */
const STALE_DIGEST = purposeScopeDigest({
  policyVersion: '0',
  dataClasses: ['persona_selections'],
  recipientIds: [],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
});

const THRESHOLDS = resolvePersonaThresholds({ minBucket: 5, minPopulation: 25 });

const SNAPSHOT: PurposeScopeSnapshot = {
  purposeLabel: 'Count my answers in community statistics',
  offSummary: 'off',
  onSummary: 'on',
  recipients: [],
  dataClasses: ['persona_selections'],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
  policyVersion: '1',
};

function fieldByKey(key: string): PersonaMetricsField {
  const found = personaMetricsFields(SECTIONS).find((f) => f.fieldKey === key);
  if (!found) throw new Error(`test setup: ${key} is not an aggregatable field`);
  return found;
}

// --- Fixture ---------------------------------------------------------------------

interface SeedUser {
  index: number;
  id: string;
}

interface SeedOptions {
  status?: 'active' | 'suspended' | 'deleted';
  visibility?: 'public' | 'members' | 'private';
  deleted?: boolean;
}

let seq = 0;

async function seedUsers(db: DB, count: number, opts: SeedOptions = {}): Promise<SeedUser[]> {
  const rows = Array.from({ length: count }, () => {
    const index = seq++;
    return {
      id: crypto.randomUUID(),
      index,
      email: `persona-${index}@example.test`,
      username: `persona_${index}`,
      displayName: `Persona ${index}`,
      status: opts.status ?? ('active' as const),
      profileVisibility: opts.visibility ?? ('public' as const),
      deletedAt: opts.deleted ? new Date() : null,
    };
  });
  await db.insert(users).values(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username,
      displayName: r.displayName,
      status: r.status,
      profileVisibility: r.profileVisibility,
      deletedAt: r.deletedAt,
    })),
  );
  return rows.map((r) => ({ index: r.index, id: r.id }));
}

async function grant(
  db: DB,
  userId: string,
  purpose: ProcessingPurposeId,
  scopeDigest: string,
  opts: { state?: 'granted' | 'revoked'; supersededAt?: Date | null } = {},
): Promise<void> {
  await db.insert(userPurposeConsents).values({
    userId,
    purpose,
    state: opts.state ?? 'granted',
    scopeDigest,
    scopeSnapshot: SNAPSHOT,
    policyVersion: '1',
    source: 'settings',
    supersededAt: opts.supersededAt ?? null,
  });
}

async function answer(db: DB, userId: string, fieldKey: string, value: string): Promise<void> {
  const sectionKey = fieldKey === 'interests' ? 'interests' : 'work';
  await db.insert(userPersonaAnswers).values({ userId, sectionKey, fieldKey, value });
}

// --- Exclusion cohorts -----------------------------------------------------------

/** Exactly the bucket floor, so a leaked cohort is VISIBLE and not suppressed. */
const EXCLUSION_COHORT = METRICS_MIN_BUCKET;

function exclusionValue(name: string): string {
  return `excl_${name}`;
}

type ExclusionCase = [name: string, seed: SeedOptions, mutate: (db: DB, userId: string) => Promise<void>];

/** One row per way the query is supposed to exclude somebody. */
const EXCLUSION_CASES: ExclusionCase[] = [
  // No consent row at all: nothing to inner join to.
  ['no_consent', {}, async () => {}],
  // Granted, then revoked. The old grant is superseded; the current row is a
  // refusal. Both must fail the join, for different reasons.
  [
    'revoked',
    {},
    async (db, userId) => {
      await grant(db, userId, 'profile_analytics', ANALYTICS_DIGEST, {
        supersededAt: new Date('2026-01-01T00:00:00Z'),
      });
      await grant(db, userId, 'profile_analytics', ANALYTICS_DIGEST, { state: 'revoked' });
    },
  ],
  // A current grant carrying a digest that no longer matches the scope.
  [
    'stale_digest',
    {},
    async (db, userId) => {
      await grant(db, userId, 'profile_analytics', STALE_DIGEST);
    },
  ],
  // Granted, but the profile is not public. Disclosed in the consent copy (B3).
  [
    'private_profile',
    { visibility: 'private' },
    async (db, userId) => {
      await grant(db, userId, 'profile_analytics', ANALYTICS_DIGEST);
    },
  ],
  [
    'members_only_profile',
    { visibility: 'members' },
    async (db, userId) => {
      await grant(db, userId, 'profile_analytics', ANALYTICS_DIGEST);
    },
  ],
  [
    'suspended',
    { status: 'suspended' },
    async (db, userId) => {
      await grant(db, userId, 'profile_analytics', ANALYTICS_DIGEST);
    },
  ],
  [
    'soft_deleted',
    { deleted: true },
    async (db, userId) => {
      await grant(db, userId, 'profile_analytics', ANALYTICS_DIGEST);
    },
  ],
  // Holds a current grant, but for a DIFFERENT purpose. Consenting to be visible
  // to recruiters is not consenting to be counted.
  [
    'other_purpose_only',
    {},
    async (db, userId) => {
      await grant(db, userId, 'recruiter_visibility', RECRUITER_DIGEST);
    },
  ],
];

// --- The main suite --------------------------------------------------------------

describe('persona metrics — consent join, k-anonymity and suppression', () => {
  let db: DB;
  /** 30 users who are eligible AND consenting. */
  let eligible: SeedUser[];

  beforeAll(async () => {
    db = await createTestDB();

    eligible = await seedUsers(db, 30);
    for (const u of eligible) {
      await grant(db, u.id, 'profile_analytics', ANALYTICS_DIGEST);
      // `sector` is the clean scalar: everybody answers the same way, so no
      // bucket is ever withheld and the field stays publishable.
      await answer(db, u.id, 'sector', 'software');
      // Free text for everyone. It must never surface anywhere.
      await db
        .insert(userPersonaText)
        .values({ userId: u.id, sectionKey: 'work', fieldKey: 'about_me', value: 'secret prose' });
    }

    // interests (multiselect): 23 rust, 4 niche, 3 unanswered.
    // 23 is deliberately not a multiple of 5, and rounds UP to 25 but floors to
    // 20, so the payload distinguishes flooring from rounding (audit B8).
    for (const u of eligible.slice(0, 23)) await answer(db, u.id, 'interests', 'rust');
    for (const u of eligible.slice(23, 27)) await answer(db, u.id, 'interests', 'niche');

    // industry (select): 25 software, 4 aerospace. The 4 is withheld, and because
    // the field is scalar the WHOLE field is then refused.
    for (const u of eligible.slice(0, 25)) await answer(db, u.id, 'industry', 'software');
    for (const u of eligible.slice(25, 29)) await answer(db, u.id, 'industry', 'aerospace');

    // Links: 23 github (visible), 4 discord (withheld).
    for (const u of eligible.slice(0, 23)) {
      await db
        .update(users)
        .set({ socialLinks: { github: `https://github.com/u${u.index}` } })
        .where(eq(users.id, u.id));
    }
    for (const u of eligible.slice(23, 27)) {
      await db
        .update(users)
        .set({ socialLinks: { discord: `https://discord.gg/u${u.index}` } })
        .where(eq(users.id, u.id));
    }
    // Audit B12: a legacy row whose social_links is not a jsonb OBJECT must not
    // blow up the link pass. Only raw SQL can produce it; the Drizzle type cannot.
    await db.execute(
      sql`UPDATE ${users} SET social_links = '"not-an-object"'::jsonb WHERE id = ${eligible[29]!.id}`,
    );

    // --- Every way a user can be excluded.
    //
    // Each category gets EXCLUSION_COHORT users answering `interests` with its
    // OWN sentinel value. Two reasons, both learned the hard way while writing
    // this file: a cohort of exactly minBucket clears the bucket floor on its
    // own, so a leak becomes a visible bucket rather than being swallowed by
    // suppression; and a distinct value per category means the failing assertion
    // NAMES the predicate that broke. Piling every excluded user onto 'rust'
    // instead hides a single-user leak inside the quantum, which is how the
    // first draft of this test passed with the scope digest deleted from the
    // join condition.
    for (const [name, opts, mutate] of EXCLUSION_CASES) {
      const cohort = await seedUsers(db, EXCLUSION_COHORT, opts);
      for (const u of cohort) {
        await mutate(db, u.id);
        await answer(db, u.id, 'interests', exclusionValue(name));
      }
    }

    // --- Audience: 10 of the eligible also grant recruiter_visibility.
    for (const u of eligible.slice(0, 10)) {
      await grant(db, u.id, 'recruiter_visibility', RECRUITER_DIGEST);
    }
  }, 180_000);

  afterAll(async () => {
    await closeTestDB(db);
  });

  const live = { thresholds: THRESHOLDS, scopeDigest: ANALYTICS_DIGEST, source: 'live' as const };

  it('counts only consenting, public, active, non-deleted users', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('interests'),
      limit: 20,
    });

    expect(dist.available).toBe(true);
    const rust = dist.items.find((i) => i.value === 'rust');
    expect(rust).toEqual({ value: 'rust', label: 'Rust', count: 20 });

    // The sharp assertion: each excluded cohort is exactly minBucket people with
    // its own sentinel value, so a broken predicate produces a NAMED bucket
    // rather than nudging 'rust' by one inside the quantum. This is what fails
    // if the scope digest, the superseded check, the state check, the purpose
    // check, the visibility filter, the status filter or the soft-delete filter
    // is removed from the join.
    expect(dist.items.map((i) => i.value)).toEqual(['rust']);
  });

  it('leaves no excluded cohort reachable through any surface', async () => {
    // Guard: the cases really were seeded, so an empty EXCLUSION_CASES cannot
    // make this pass green.
    expect(EXCLUSION_CASES.length).toBeGreaterThanOrEqual(8);
    const [seeded] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    expect(seeded?.n).toBe(30 + EXCLUSION_CASES.length * EXCLUSION_COHORT);

    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('interests'),
      limit: 100,
    });
    for (const [name] of EXCLUSION_CASES) {
      expect(dist.items.map((i) => i.value)).not.toContain(exclusionValue(name));
    }

    // Same for the population figure: 30 eligible, and any leaked cohort of five
    // would move it to 35.
    const audience = await getAudienceCounts(db, {
      ...live,
      offeredPurposes: [{ purpose: 'profile_analytics', scopeDigest: ANALYTICS_DIGEST }],
    });
    expect(audience.sharingAnalytics).toEqual({ available: true, count: 30 });
  });

  it('floors the published count rather than rounding to nearest (audit B8)', () => {
    // Stated as an invariant on the pure function too, so the rule survives a
    // change to the fixture.
    expect(quantisePersonaCount(23, 5)).toBe(20);
    expect(quantisePersonaCount(8, 5)).toBe(5);
    expect(quantisePersonaCount(5, 5)).toBe(5);
    expect(quantisePersonaCount(29, 5)).toBe(25);
  });

  it('withholds a below-floor bucket of a multiselect and publishes the rest', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('interests'),
      limit: 20,
    });

    expect(dist.available).toBe(true);
    expect(dist.items.map((i) => i.value)).toEqual(['rust']);
    expect(dist.items.some((i) => i.value === 'niche')).toBe(false);
    // A bucket COUNT, not a person count.
    expect(dist.suppressed).toBe(1);
    expect(dist.quantum).toBe(5);
  });

  it('refuses the WHOLE field when a scalar field has a withheld bucket', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('industry'),
      limit: 20,
    });

    expect(dist.available).toBe(false);
    expect(dist.reason).toBe('insufficient_bucket_diversity');
    expect(dist.items).toEqual([]);
    // The refusal must not itself disclose how many options were rare.
    expect(dist.suppressed).toBe(0);
  });

  it('publishes a scalar field with no withheld bucket', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('sector'),
      limit: 20,
    });

    expect(dist.available).toBe(true);
    expect(dist.suppressed).toBe(0);
    expect(dist.items).toEqual([{ value: 'software', label: 'Software', count: 30 }]);
  });

  it('never returns an eligible-population figure on a distribution (differencing oracle)', async () => {
    for (const key of AGGREGATABLE_KEYS) {
      const dist = await getPersonaFieldDistribution(db, {
        ...live,
        field: fieldByKey(key),
        limit: 20,
      });
      const keys = Object.keys(dist);
      expect(keys).not.toContain('eligibleUsers');
      expect(keys).not.toContain('total');
      expect(keys).not.toContain('population');
      expect(keys).not.toContain('respondents');
    }
  });

  it('never surfaces a free-text answer, because the text table is not imported', async () => {
    // 1. A free-text field is not in the countable partition at all.
    const countable = personaMetricsFields(SECTIONS).map((f) => f.fieldKey);
    expect(countable).not.toContain('about_me');

    // 2. Even a fabricated descriptor for that key reads nothing: the query only
    //    ever touches `user_persona_answers`.
    const forged: PersonaMetricsField = {
      sectionKey: 'work',
      fieldKey: 'about_me',
      label: 'About you',
      cardinality: 'scalar',
      options: [],
    };
    const dist = await getPersonaFieldDistribution(db, { ...live, field: forged, limit: 20 });
    expect(dist.items).toEqual([]);

    // 3. Prove the rows really are there, so assertions 1 and 2 are not vacuous.
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(userPersonaText);
    expect(row?.n).toBe(30);
  });

  it('excludes a sensitive field and a link field from the countable partition', () => {
    const countable = personaMetricsFields(SECTIONS).map((f) => f.fieldKey);
    expect(countable).toEqual(['industry', 'sector', 'interests']);
    expect(countable).not.toContain('health');
    expect(countable).not.toContain('link_github');
  });

  it('counts link presence from users.social_links and survives a non-object value', async () => {
    const presence = await getPersonaLinkPresence(db, {
      ...live,
      platforms: BUILTIN_PERSONA_LINK_PLATFORMS,
    });

    expect(presence.available).toBe(true);
    expect(presence.items).toEqual([
      { platform: 'github', label: 'GitHub', count: 20, authenticitySignal: true },
    ]);
    // discord had 4 holders: withheld, and reported only as a bucket count.
    expect(presence.suppressed).toBe(1);
    expect(presence.quantum).toBe(5);
  });

  it('counts an audience only on a DOUBLE consent join', async () => {
    const audience = await getAudienceCounts(db, {
      ...live,
      offeredPurposes: [
        { purpose: 'profile_analytics', scopeDigest: ANALYTICS_DIGEST },
        { purpose: 'recruiter_visibility', scopeDigest: RECRUITER_DIGEST },
      ],
    });

    expect(audience.available).toBe(true);
    expect(audience.sharingAnalytics).toEqual({ available: true, count: 30 });
    // 10 hold both. The 3 who hold only recruiter_visibility are not counted.
    expect(audience.openToRecruiters).toEqual({ available: true, count: 10 });
  });

  it('reports a non-offerable purpose as such, never as a structural zero (audit B9)', async () => {
    const audience = await getAudienceCounts(db, {
      ...live,
      offeredPurposes: [
        { purpose: 'profile_analytics', scopeDigest: ANALYTICS_DIGEST },
        { purpose: 'recruiter_visibility', scopeDigest: RECRUITER_DIGEST },
      ],
    });

    expect(audience.openToSponsorSharing).toEqual({
      available: false,
      reason: 'purpose_not_offered',
    });
    expect(audience.openToSponsorSharing).not.toEqual({ available: true, count: 0 });
  });
});

// --- Population floor -------------------------------------------------------------

describe('persona metrics — population floor', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    const thin = await seedUsers(db, 10);
    for (const u of thin) {
      await grant(db, u.id, 'profile_analytics', ANALYTICS_DIGEST);
      await answer(db, u.id, 'sector', 'software');
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestDB(db);
  });

  const live = { thresholds: THRESHOLDS, scopeDigest: ANALYTICS_DIGEST, source: 'live' as const };

  it('darkens the whole surface below minPopulation', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('sector'),
      limit: 20,
    });
    expect(dist).toMatchObject({ available: false, reason: 'insufficient_population', items: [] });

    const presence = await getPersonaLinkPresence(db, {
      ...live,
      platforms: BUILTIN_PERSONA_LINK_PLATFORMS,
    });
    expect(presence).toMatchObject({ available: false, reason: 'insufficient_population' });

    const audience = await getAudienceCounts(db, {
      ...live,
      offeredPurposes: [{ purpose: 'profile_analytics', scopeDigest: ANALYTICS_DIGEST }],
    });
    expect(audience).toMatchObject({ available: false, reason: 'insufficient_population' });
    // The per-purpose slot carries the real reason, not a misleading
    // "not offered" for a purpose the operator is in fact offering.
    expect(audience.sharingAnalytics).toEqual({
      available: false,
      reason: 'insufficient_population',
    });
  });

  it('a bucket that would clear minBucket is still dark below minPopulation', async () => {
    // 10 people all answered 'software', which clears a bucket floor of 5. The
    // population floor is a separate defence, not a duplicate of the bucket one.
    const dist = await getPersonaFieldDistribution(db, {
      ...live,
      field: fieldByKey('sector'),
      limit: 20,
    });
    expect(dist.items).toEqual([]);
  });
});

// --- Rollup and finalisation --------------------------------------------------------

describe('persona metrics — rollup, finalisation and snapshot reads', () => {
  let db: DB;
  let eligible: SeedUser[];

  const rollupInput = (day: string) => ({
    day,
    fields: personaMetricsFields(SECTIONS),
    platforms: BUILTIN_PERSONA_LINK_PLATFORMS,
    thresholds: THRESHOLDS,
    offeredPurposes: [
      { purpose: 'profile_analytics' as const, scopeDigest: ANALYTICS_DIGEST },
      { purpose: 'recruiter_visibility' as const, scopeDigest: RECRUITER_DIGEST },
    ],
  });

  const fromRollup = {
    thresholds: THRESHOLDS,
    scopeDigest: ANALYTICS_DIGEST,
    source: 'rollup' as const,
  };

  beforeAll(async () => {
    db = await createTestDB();
    eligible = await seedUsers(db, 30);
    for (const u of eligible) {
      await grant(db, u.id, 'profile_analytics', ANALYTICS_DIGEST);
      await answer(db, u.id, 'sector', 'software');
    }
    for (const u of eligible.slice(0, 23)) await answer(db, u.id, 'interests', 'rust');
    for (const u of eligible.slice(23, 27)) await answer(db, u.id, 'interests', 'niche');
    for (const u of eligible.slice(0, 25)) await answer(db, u.id, 'industry', 'software');
    for (const u of eligible.slice(25, 29)) await answer(db, u.id, 'industry', 'aerospace');
    for (const u of eligible.slice(0, 23)) {
      await db
        .update(users)
        .set({ socialLinks: { github: `https://github.com/r${u.index}` } })
        .where(eq(users.id, u.id));
    }
    for (const u of eligible.slice(0, 10)) {
      await grant(db, u.id, 'recruiter_visibility', RECRUITER_DIGEST);
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('serves no_snapshot_yet with a null asOf before any day is final', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...fromRollup,
      field: fieldByKey('sector'),
      limit: 20,
    });
    expect(dist).toMatchObject({ available: false, reason: 'no_snapshot_yet', asOf: null });

    const presence = await getPersonaLinkPresence(db, {
      ...fromRollup,
      platforms: BUILTIN_PERSONA_LINK_PLATFORMS,
    });
    expect(presence).toMatchObject({ available: false, reason: 'no_snapshot_yet', asOf: null });

    const audience = await getAudienceCounts(db, {
      ...fromRollup,
      offeredPurposes: rollupInput('2026-08-12').offeredPurposes,
    });
    expect(audience).toMatchObject({ available: false, reason: 'no_snapshot_yet', asOf: null });
  });

  it('writes today unfinalised and finalises nothing on the first run', async () => {
    const result = await runPersonaRollup(db, rollupInput('2026-08-12'));
    expect(result.day).toBe('2026-08-12');
    expect(result.rowsWritten).toBeGreaterThan(0);
    // There is no yesterday to close: the plan says write nothing rather than
    // invent a day the instance was not running for.
    expect(result.finalisedDay).toBeNull();
    expect(await latestFinalisedSnapshot(db)).toBeNull();
  });

  it('is idempotent for the same day', async () => {
    const before = await runPersonaRollup(db, rollupInput('2026-08-12'));
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(personaMetricsDaily)
      .where(eq(personaMetricsDaily.day, '2026-08-12'));
    expect(row?.n).toBe(before.rowsWritten);
  });

  it('finalises yesterday on the next run', async () => {
    const result = await runPersonaRollup(db, rollupInput('2026-08-13'));
    expect(result.finalisedDay).toBe('2026-08-12');
    expect(result.finalisedRows).toBeGreaterThan(0);

    const snapshot = await latestFinalisedSnapshot(db);
    expect(snapshot?.day).toBe('2026-08-12');
    expect(snapshot?.populationSuppressed).toBe(false);
    expect(snapshot?.population).toBe(30);
  });

  it('does not re-finalise a day that is already final', async () => {
    // Running 2026-08-13 again finds yesterday already final and leaves it alone.
    const result = await runPersonaRollup(db, rollupInput('2026-08-13'));
    expect(result.finalisedDay).toBeNull();
    expect(result.finalisedRows).toBe(0);
  });

  it('stores nothing but quantised counts and bucket-count markers', async () => {
    const rows = await db
      .select({
        metric: personaMetricsDaily.metric,
        dimension: personaMetricsDaily.dimension,
        value: personaMetricsDaily.value,
        suppressed: personaMetricsDaily.suppressed,
      })
      .from(personaMetricsDaily)
      .where(eq(personaMetricsDaily.day, '2026-08-12'));

    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const r of rows) {
      expect(r.dimension).not.toBe('');
      if (r.dimension === PERSONA_SUPPRESSED_DIMENSION) {
        // A count of withheld BUCKETS is not a person count and is not quantised.
        expect(r.suppressed).toBe(true);
        continue;
      }
      expect(Number(r.value) % METRICS_MIN_BUCKET).toBe(0);
    }
  });

  it('never stores the buckets of a wholly-suppressed scalar field', async () => {
    const rows = await db
      .select({ dimension: personaMetricsDaily.dimension })
      .from(personaMetricsDaily)
      .where(
        and(
          eq(personaMetricsDaily.day, '2026-08-12'),
          eq(personaMetricsDaily.metric, personaFieldMetric('industry')),
        ),
      );

    // Only the withheld-bucket marker survives. Guarantee 6 is applied at WRITE,
    // so a finalised day cannot be read back into the partial list the read path
    // would have refused.
    expect(rows.map((r) => r.dimension)).toEqual([PERSONA_SUPPRESSED_DIMENSION]);
  });

  it('serves a finalised day with asOf, matching the live answers', async () => {
    const dist = await getPersonaFieldDistribution(db, {
      ...fromRollup,
      field: fieldByKey('interests'),
      limit: 20,
    });
    expect(dist.available).toBe(true);
    expect(dist.asOf).toBe('2026-08-12');
    expect(dist.items).toEqual([{ value: 'rust', label: 'Rust', count: 20 }]);
    expect(dist.suppressed).toBe(1);

    const scalar = await getPersonaFieldDistribution(db, {
      ...fromRollup,
      field: fieldByKey('industry'),
      limit: 20,
    });
    expect(scalar).toMatchObject({
      available: false,
      reason: 'insufficient_bucket_diversity',
      asOf: '2026-08-12',
    });

    const presence = await getPersonaLinkPresence(db, {
      ...fromRollup,
      platforms: BUILTIN_PERSONA_LINK_PLATFORMS,
    });
    expect(presence.available).toBe(true);
    expect(presence.asOf).toBe('2026-08-12');
    expect(presence.items).toEqual([
      { platform: 'github', label: 'GitHub', count: 20, authenticitySignal: true },
    ]);

    const audience = await getAudienceCounts(db, {
      ...fromRollup,
      offeredPurposes: rollupInput('2026-08-13').offeredPurposes,
    });
    expect(audience.available).toBe(true);
    expect(audience.asOf).toBe('2026-08-12');
    expect(audience.sharingAnalytics).toEqual({ available: true, count: 30 });
    expect(audience.openToRecruiters).toEqual({ available: true, count: 10 });
    expect(audience.openToSponsorSharing).toEqual({
      available: false,
      reason: 'purpose_not_offered',
    });
  });

  it('a finalised day below the population floor reads as insufficient_population', async () => {
    const thin = await createTestDB();
    try {
      const few = await seedUsers(thin, 6);
      for (const u of few) {
        await grant(thin, u.id, 'profile_analytics', ANALYTICS_DIGEST);
        await answer(thin, u.id, 'sector', 'software');
      }
      await runPersonaRollup(thin, rollupInput('2026-08-12'));
      await runPersonaRollup(thin, rollupInput('2026-08-13'));

      const snapshot = await latestFinalisedSnapshot(thin);
      expect(snapshot?.populationSuppressed).toBe(true);

      const dist = await getPersonaFieldDistribution(thin, {
        ...fromRollup,
        field: fieldByKey('sector'),
        limit: 20,
      });
      // A day that exists but is dark is a DIFFERENT answer from no day at all,
      // and an operator needs to be able to tell them apart.
      expect(dist).toMatchObject({
        available: false,
        reason: 'insufficient_population',
        asOf: '2026-08-12',
      });
    } finally {
      await closeTestDB(thin);
    }
  }, 120_000);
});

// --- Pure helpers and the structural guarantee ------------------------------------

describe('persona metrics — thresholds and day keys', () => {
  it('clamps configured thresholds to the floors and never below them', () => {
    expect(resolvePersonaThresholds({ minBucket: 1, minPopulation: 2 })).toEqual({
      minBucket: METRICS_MIN_BUCKET,
      minPopulation: MIN_AUDIENCE_POPULATION,
    });
    expect(resolvePersonaThresholds({ minBucket: 10, minPopulation: 100 })).toEqual({
      minBucket: 10,
      minPopulation: 100,
    });
    expect(resolvePersonaThresholds(undefined)).toEqual({
      minBucket: METRICS_MIN_BUCKET,
      minPopulation: MIN_AUDIENCE_POPULATION,
    });
    expect(resolvePersonaThresholds({ minBucket: Number.NaN })).toEqual({
      minBucket: METRICS_MIN_BUCKET,
      minPopulation: MIN_AUDIENCE_POPULATION,
    });
  });

  it('walks UTC days backwards across a month and a year boundary', () => {
    expect(previousUtcDay('2026-08-12')).toBe('2026-08-11');
    expect(previousUtcDay('2026-08-01')).toBe('2026-07-31');
    expect(previousUtcDay('2026-01-01')).toBe('2025-12-31');
    expect(previousUtcDay('2024-03-01')).toBe('2024-02-29');
  });
});

describe('persona metrics — the free-text table is not reachable from this module', () => {
  it('the source contains no reference to the free-text table', () => {
    const file = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../persona/metrics.ts',
    );
    const source = readFileSync(file, 'utf8');
    // P7 guard: a broken path must fail, not pass green on an empty read.
    expect(source.length).toBeGreaterThan(2000);
    expect(source).toContain('getPersonaFieldDistribution');

    expect(source).not.toContain('userPersonaText');
    expect(source).not.toContain('user_persona_text');
  });
});
