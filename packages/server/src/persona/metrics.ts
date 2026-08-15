import {
  personaMetricsDaily,
  userPersonaAnswers,
  userPurposeConsents,
  userSharedLinks,
  userStatisticsObjections,
  users,
} from '@commonpub/schema';
import {
  METRICS_MIN_BUCKET,
  MIN_AUDIENCE_POPULATION,
  PROCESSING_PURPOSES,
  isPersonaFieldAggregatable,
  personaFieldSpec,
  statisticsCovers,
} from '@commonpub/persona';
import type {
  PersonaDataClass,
  PersonaLinkPlatformSpec,
  PersonaSection,
  ProcessingPurposeId,
} from '@commonpub/persona';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { DB } from '../types.js';
import { rowsOf } from '../query.js';

/**
 * Persona statistics: the k-anonymous aggregation layer, and the audience counts
 * that sit beside it.
 *
 * THE CORRECTION THIS FILE CARRIES (plan `profile-persona-information-
 * architecture.md`, R2.5 and R3.3). Counting answers into group totals used to
 * be gated on a consent purpose called `profile_analytics`. That purpose is
 * gone, and not renamed: the instance holds those anonymous totals over its own
 * members regardless, computed from records it already controls, so asking
 * permission for processing that happens either way was a dark pattern with good
 * intentions. Statistics now run on legitimate interest (Art. 6(1)(f)) and the
 * member holds the right that belongs to that basis, an OBJECTION (Art. 21).
 * The consent INNER JOIN became an objection ANTI-JOIN, which is the same shape
 * inverted. `@commonpub/persona`'s `statistics.ts` owns the words; this file
 * owns the query.
 *
 * WHAT STILL RUNS ON CONSENT: the audience counts, and only those. "How many
 * members are open to recruiters" is a count of people who granted a purpose
 * that names a third party, so it keeps the digest-bound INNER JOIN it always
 * had, one join now instead of two.
 *
 * FOUR STRUCTURAL GUARANTEES, in order of importance (plan section 7.2). Each is
 * a property of the code's shape, not a rule someone has to remember:
 *
 * 1. **The objection is ONE term inside {@link countedUserWhere}, which every
 *    query in this file already calls.** Written the textbook way, as a
 *    `LEFT JOIN ... WHERE o.user_id IS NULL`, the exclusion is split across two
 *    clauses and a query that keeps the join and drops the predicate silently
 *    counts the people who refused. As a `NOT EXISTS` inside the one eligibility
 *    helper it plans as the same anti-join and cannot be half-applied: a query
 *    that omits it also omits the soft-delete, status and visibility filters,
 *    which is not a subtle failure. There is no second definition of "counted".
 *
 * 2. **`HAVING count(*) >= minBucket` runs in the database.** A suppressed count
 *    never enters the Node process, so no log line, no serialiser and no stack
 *    trace can leak it.
 *
 * 3. **This module contains NO reference to the persona free-text table.**
 *    Free-text answers cannot leak into an aggregate because that table is not
 *    imported. Leakage would be a missing import, not a forgotten rule, and a
 *    source sweep asserts the absence by name.
 *
 * 4. **No distribution ever returns an eligible-population figure.** Visible
 *    quantised buckets plus a total is a differencing oracle: with one suppressed
 *    bucket the hidden count is recoverable to within a quantum. The population
 *    appears only on the audience payload, quantised.
 *
 * K-ANONYMITY IS UNCHANGED AND ITS JOB HAS MOVED (R2.7). The floors, the
 * downward flooring and the whole-field suppression are byte for byte what they
 * were. What they protect is different: they are no longer what keeps a member
 * from being counted, because the objection does that and does it by name. They
 * are what makes the PUBLISHED output genuinely anonymous, which is the thing
 * that keeps an aggregate over records the instance holds anyway from becoming a
 * statement about one identifiable person. That is a better fit for what
 * suppression actually does, and it is why none of it is relaxed here.
 *
 * Feature gating (`persona`, `personaAnalytics`, `dataSharingConsents`) happens at
 * the route boundary with `requireFeature`, which throws 404. This package is
 * framework-agnostic and takes resolved values as parameters.
 */

// --- Thresholds -----------------------------------------------------------------

/**
 * Re-exported so `packages/server` has no floor of its own to drift from. The
 * single source is `@commonpub/persona` (audit B5); the operator config values
 * are what the queries use, and these are the floors those values are clamped to.
 */
export { METRICS_MIN_BUCKET, MIN_AUDIENCE_POPULATION };

export interface PersonaMetricsThresholds {
  /** Minimum people in a published bucket. Never below `METRICS_MIN_BUCKET`. */
  minBucket: number;
  /** Minimum COUNTED population for the whole surface. Never below `MIN_AUDIENCE_POPULATION`. */
  minPopulation: number;
}

/**
 * Clamp the operator's configured thresholds to the hard floors.
 *
 * The constants are FLOORS, never values: an operator staring at thin numbers can
 * raise them and cannot dial them below the floor, and a missing or malformed
 * config value resolves to the floor rather than to zero.
 */
export function resolvePersonaThresholds(
  configured?: { minBucket?: number; minPopulation?: number } | null,
): PersonaMetricsThresholds {
  const clamp = (value: number | undefined, floor: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return floor;
    return Math.max(floor, Math.floor(value));
  };
  return {
    minBucket: clamp(configured?.minBucket, METRICS_MIN_BUCKET),
    minPopulation: clamp(configured?.minPopulation, MIN_AUDIENCE_POPULATION),
  };
}

/**
 * Quantise a published count DOWNWARD to a multiple of the bucket floor.
 *
 * Audit B8: the draft rounded to nearest, which publishes 10 when the truth is 8.
 * On a small instance that is a false statement and it inflates every cohort an
 * operator is using to make recruiting and sponsorship decisions. Flooring never
 * overstates and is equally protective, because the input already cleared the
 * bucket floor in SQL.
 */
export function quantisePersonaCount(count: number, quantum: number): number {
  if (quantum <= 0) return count;
  return Math.floor(count / quantum) * quantum;
}

/**
 * A row count that is safe to send across an HTTP boundary or into `audit_logs`.
 *
 * THE ADMIN SURFACES GET NO EXEMPTION. `/api/admin/persona-metrics` already
 * refuses to say "3 people are interested in PCB design" because on a 40-person
 * instance that re-identifies somebody regardless of who is looking, and the
 * same sentence is no safer coming out of the schema editor. Before this
 * existed, PUTting the identical schema document with one option removed
 * answered with the exact count for that option and wrote nothing, so eighteen
 * requests reconstructed the exact distribution of an eighteen-option field
 * over every member INCLUDING those every published aggregate excludes, gated on
 * `settings.manage` rather than on `audit.read`.
 *
 * Below the floor the count is reported as a band ("fewer than k") and the
 * numeric field is 0; at or above it, floored to a multiple of the floor, the
 * same treatment every published count gets. An operator still learns that a
 * change is destructive and roughly how much it costs, which is what they need
 * to make the decision.
 */
export interface PersonaCountBand {
  /** Floored, or 0 when the true count is below the floor. Never the raw number. */
  value: number;
  /** Human phrase for the count alone, e.g. `"fewer than 5"` or `"15"`. */
  phrase: string;
  /** True when the real count was withheld because it fell under the floor. */
  banded: boolean;
}

export function bandPersonaCount(
  count: number,
  minBucket: number = METRICS_MIN_BUCKET,
): PersonaCountBand {
  const floor = Math.max(1, Math.floor(minBucket));
  if (count <= 0) return { value: 0, phrase: '0', banded: false };
  if (count < floor) return { value: 0, phrase: `fewer than ${floor}`, banded: true };
  const value = quantisePersonaCount(count, floor);
  return { value, phrase: String(value), banded: false };
}

// --- Field descriptors ----------------------------------------------------------

/**
 * The minimum a distribution needs to know about a field. Callers resolve this
 * from the EFFECTIVE persona schema (file plus DB overrides, drifted and retired
 * keys already excluded) before calling in, so an arbitrary `fieldKey` is a clean
 * 400 at the route and never reaches a SQL bind. Validate the domain, not the shape.
 */
export interface PersonaMetricsField {
  sectionKey: string;
  fieldKey: string;
  label: string;
  /**
   * `'scalar'` for select/radio/checkbox, `'set'` for multiselect. It decides
   * whether a partial list is safe to publish (see `assemblePersonaDistribution`).
   */
  cardinality: 'scalar' | 'set';
  options: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Derive the countable fields from an effective persona schema.
 *
 * Pure. `isPersonaFieldAggregatable` is the single partition predicate and is not
 * re-derived here: a field is countable only when its sink is `answers` AND its
 * type is structurally countable, which is what keeps free text, links and
 * column-bound fields structurally out of every aggregate.
 */
export function personaMetricsFields(
  sections: readonly PersonaSection[],
): PersonaMetricsField[] {
  const out: PersonaMetricsField[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (!isPersonaFieldAggregatable(field)) continue;
      const cardinality = personaFieldSpec(field.type).cardinality;
      // Aggregatable implies a countable cardinality; the guard is belt and
      // braces so a future registry edit cannot silently widen the partition.
      if (cardinality !== 'scalar' && cardinality !== 'set') continue;
      out.push({
        sectionKey: section.key,
        fieldKey: field.key,
        label: field.label,
        cardinality,
        options: field.options ?? [],
      });
    }
  }
  return out;
}

// --- Payload shapes -------------------------------------------------------------

/**
 * Why a distribution or a link-presence payload is dark.
 *
 * TWO MEMBERS LEFT WITH THE ANALYTICS PURPOSE. `scope_changed` and
 * `purpose_not_offered` were both statements about a CONSENT scope, and neither
 * can describe a field distribution any more: nothing a member consents to
 * decides whether the instance counts its own answers, so a moved digest cannot
 * darken this surface and there is no purpose here to be unoffered. They are
 * deleted rather than kept as reasons that can never fire.
 * {@link PersonaAudienceUnavailableReason} keeps both, because the audience
 * counts really are consent counts.
 */
export type PersonaUnavailableReason =
  | 'insufficient_population'
  | 'insufficient_bucket_diversity'
  | 'no_snapshot_yet'
  | 'statistics_not_covered';

export interface PersonaDistributionItem {
  value: string;
  label: string;
  count: number;
}

/**
 * A single field's distribution.
 *
 * There is deliberately NO `eligibleUsers`, no `total` and no `population` key on
 * this interface, and adding one is the differencing oracle described at the top
 * of this file. A test asserts the key is absent from a real response.
 */
export interface PersonaDistribution {
  field: string;
  label: string;
  items: PersonaDistributionItem[];
  /** Number of buckets withheld. A bucket COUNT, never a person count. */
  suppressed: number;
  /** Published counts are floored to a multiple of this. */
  quantum: number;
  available: boolean;
  reason?: PersonaUnavailableReason;
  /** The finalised UTC day served, or null for a live read and for no snapshot. */
  asOf: string | null;
}

export interface PersonaLinkPresenceItem {
  platform: string;
  label: string;
  count: number;
  authenticitySignal: boolean;
}

export interface PersonaLinkPresence {
  items: PersonaLinkPresenceItem[];
  suppressed: number;
  quantum: number;
  available: boolean;
  reason?: PersonaUnavailableReason;
  asOf: string | null;
}

/**
 * One purpose's audience count.
 *
 * Audit B9: a purpose nobody can grant yet must not publish a hard zero, because
 * a zero that means "not implemented" reads identically to a zero that means
 * "nobody opted in". Non-offerable purposes report themselves as such.
 */
export type PersonaAudienceUnavailableReason =
  | 'purpose_not_offered'
  | 'insufficient_population'
  | 'scope_changed'
  | 'no_snapshot_yet';

export type PersonaAudienceCount =
  | { available: true; count: number }
  | { available: false; reason: PersonaAudienceUnavailableReason };

/**
 * The ONE map from a registry purpose id to its published payload key.
 *
 * The wire names predate the registry and do not match the ids, so the mapping
 * has to exist somewhere; the question is whether it exists once as data or four
 * times by hand. It was four (the unavailable builder, the rollup branch, the
 * live branch and the OpenAPI description), which meant adding the third purpose
 * R3.6 describes how to add would be four silent edits the compiler could not
 * point at, because the interface simply would not have the key.
 *
 * `satisfies` makes a missing purpose a typecheck failure, and
 * {@link PersonaAudienceCounts} is derived from it, so a new purpose breaks
 * every construction site until it is handled.
 */
export const PERSONA_AUDIENCE_PAYLOAD_KEYS = {
  recruiter_visibility: 'openToRecruiters',
  sponsor_sharing: 'openToSponsorSharing',
} as const satisfies Record<ProcessingPurposeId, string>;

export type PersonaAudiencePayloadKey =
  (typeof PERSONA_AUDIENCE_PAYLOAD_KEYS)[ProcessingPurposeId];

type PersonaAudienceSlots = {
  [P in ProcessingPurposeId as (typeof PERSONA_AUDIENCE_PAYLOAD_KEYS)[P]]: PersonaAudienceCount;
};

export interface PersonaAudienceCounts extends PersonaAudienceSlots {
  quantum: number;
  available: boolean;
  /**
   * The AUDIENCE union, not the distribution one. It was the distribution union
   * while the two overlapped; they no longer do, and a payload whose whole-
   * surface reason cannot be one its own slots can carry would be a type that
   * describes a state this code cannot produce.
   */
  reason?: PersonaAudienceUnavailableReason;
  asOf: string | null;
}

const PURPOSE_NOT_OFFERED: PersonaAudienceCount = {
  available: false,
  reason: 'purpose_not_offered',
};

/** Build the per-purpose slots by iterating the registry, never by hand. */
function audienceSlots(
  slot: (purpose: ProcessingPurposeId) => PersonaAudienceCount,
): PersonaAudienceSlots {
  const out = {} as Record<PersonaAudiencePayloadKey, PersonaAudienceCount>;
  for (const purpose of PROCESSING_PURPOSES) {
    out[PERSONA_AUDIENCE_PAYLOAD_KEYS[purpose]] = slot(purpose);
  }
  return out as PersonaAudienceSlots;
}

// --- Rollup metric keys ---------------------------------------------------------

/**
 * Persona writes into its OWN rollup table, never `metrics_daily` (plan 14.4).
 * That is what stops the `/metrics/timeseries` back door existing at all: that
 * route is guarded by `read:analytics` alone, which `read:*` satisfies, so a
 * persona row in the shared table would be reachable around every gate this
 * feature adds.
 */
export const PERSONA_METRIC_META = 'persona.meta';
export const PERSONA_META_POPULATION = 'population';
export const PERSONA_LINK_METRIC = 'persona.link.presence';
export const PERSONA_AUDIENCE_DIMENSION = 'count';

/**
 * Prefix of the meta dimension carrying the CONSENT SCOPE DIGEST a day's
 * AUDIENCE counts were computed under.
 *
 * NARROWED BY THE CORRECTION, and worth being exact about what it now covers.
 * The field distributions and the link presence on a stored day are not consent
 * counts any more, so no digest can invalidate them and none is checked when
 * they are read. The audience counts still are: an operator adding a recipient
 * at 09:00 invalidates every stored grant, and without this row the public
 * endpoints would keep publishing "40 members are open to recruiters" from
 * grants that now authorise nothing, until the next finalisation up to ~30 hours
 * later. Storing the digest makes exactly that figure refusable on read, and
 * leaves the rest of the day servable, which is the honest split.
 *
 * `:` cannot appear in a persona option value or platform key (both
 * `^[a-z0-9_]+$`), so this prefix cannot collide with a real dimension, the same
 * argument {@link PERSONA_SUPPRESSED_DIMENSION} makes.
 */
export const PERSONA_META_SCOPE_PREFIX = 'scope:';

/**
 * A finalised day older than this is not served at all.
 *
 * Without a bound, a stopped rollup worker (or `personaAnalytics` switched off
 * with the endpoints left reachable) keeps publishing an arbitrarily old day as
 * if it were current. Seven days is long enough to survive a weekend outage and
 * short enough that nobody mistakes it for live.
 */
export const PERSONA_SNAPSHOT_MAX_AGE_DAYS = 7;

export function personaScopeDimension(digest: string): string {
  return `${PERSONA_META_SCOPE_PREFIX}${digest}`;
}

/**
 * The dimension a withheld-bucket COUNT is filed under.
 *
 * `*` cannot appear in a persona option value or a platform key (both are
 * `^[a-z0-9_]+$`), so this sentinel can never collide with a real dimension. It
 * records HOW MANY buckets were withheld and never which ones: publishing the
 * withheld values would itself say "between one and k-1 people chose this".
 */
export const PERSONA_SUPPRESSED_DIMENSION = '*suppressed';

export function personaFieldMetric(fieldKey: string): string {
  return `persona.field.${fieldKey}`;
}

export function personaAudienceMetric(purpose: ProcessingPurposeId): string {
  return `persona.audience.${purpose}`;
}

// --- Shared query fragments -----------------------------------------------------

/**
 * The Art. 21 objection, as ONE predicate.
 *
 * Row present in `user_statistics_objections` means the member objected; absent
 * means they did not. There is no state column and no default value to drift,
 * so "has not objected" is exactly "has no row", which is what makes this a
 * plain anti-join.
 *
 * Written as `NOT EXISTS` rather than the `LEFT JOIN ... IS NULL` the plan
 * sketches, for the reason given in guarantee 1 at the top of the file: the two
 * plan identically in Postgres, and only one of them is a single term that a
 * query cannot keep half of. It also composes into the raw link-presence CTE
 * unchanged, so both spellings of the eligibility rule stay one definition.
 */
function notObjected(): SQL {
  return sql`NOT EXISTS (
    SELECT 1 FROM ${userStatisticsObjections}
    WHERE ${userStatisticsObjections.userId} = ${users.id}
  )`;
}

/**
 * The only definition of "a user whose answers are counted".
 *
 * `profile_visibility = 'public'` is stated in the statistics copy for the same
 * reason it was stated on the old consent card (audit B3): a member who goes
 * private stops being counted, and they were told so before it happened.
 *
 * `and()` returns undefined only when it is given no conditions; there are four.
 */
function countedUserWhere(): SQL {
  return and(
    isNull(users.deletedAt),
    eq(users.status, 'active'),
    eq(users.profileVisibility, 'public'),
    notObjected(),
  )!;
}

/**
 * THE consent join condition, now used by the audience counts alone.
 *
 * `uq_purpose_current` (a partial unique index on `superseded_at IS NULL`)
 * guarantees at most one current row per (user, purpose), so the join can never
 * multiply a user across rows and inflate a count.
 */
/**
 * Structural, so the same helper serves the base table and every `alias()` of it
 * (an alias is a different TYPE in Drizzle, keyed on its name, and the audience
 * query needs two aliases of this table in one statement).
 */
type ConsentColumns = {
  userId: PgColumn;
  purpose: PgColumn;
  state: PgColumn;
  supersededAt: PgColumn;
  scopeDigest: PgColumn;
};

function currentGrant(
  consents: ConsentColumns,
  purpose: ProcessingPurposeId,
  scopeDigest: string,
) {
  return and(
    eq(consents.userId, users.id),
    eq(consents.purpose, purpose),
    eq(consents.state, 'granted'),
    isNull(consents.supersededAt),
    eq(consents.scopeDigest, scopeDigest),
  );
}

/**
 * How many users this instance counts at all. Never published raw.
 *
 * No consent join and no digest: this is a count of the instance's own members,
 * minus the ones who objected. The population floor it feeds is unchanged and
 * still the first thing every surface checks, because a total drawn from a
 * handful of people is not anonymous however it is bucketed.
 */
async function countedPopulation(db: DB): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(countedUserWhere());
  return row?.n ?? 0;
}

// --- Distribution ---------------------------------------------------------------

interface RawBucket {
  value: string;
  count: number;
}

/** Visible buckets only: the floor is applied by the database, in HAVING. */
async function liveFieldBuckets(
  db: DB,
  field: PersonaMetricsField,
  minBucket: number,
  limit: number,
): Promise<RawBucket[]> {
  const rows = await db
    .select({ value: userPersonaAnswers.value, count: sql<number>`count(*)::int` })
    .from(userPersonaAnswers)
    .innerJoin(users, eq(users.id, userPersonaAnswers.userId))
    .where(and(eq(userPersonaAnswers.fieldKey, field.fieldKey), countedUserWhere()))
    .groupBy(userPersonaAnswers.value)
    .having(sql`count(*) >= ${minBucket}`)
    .orderBy(desc(sql`count(*)`), asc(userPersonaAnswers.value))
    .limit(limit);
  return rows.map((r) => ({ value: r.value, count: r.count }));
}

/**
 * How many buckets were withheld — a count of GROUPS, not of people.
 *
 * The inner query's small counts are consumed by `count(*)` inside the database
 * and are never returned, so guarantee 2 holds: the only number that crosses the
 * wire is "n buckets were too small to publish".
 */
async function liveFieldSuppressedBuckets(
  db: DB,
  field: PersonaMetricsField,
  minBucket: number,
): Promise<number> {
  const withheld = db
    .select({ marker: sql<number>`1`.as('marker') })
    .from(userPersonaAnswers)
    .innerJoin(users, eq(users.id, userPersonaAnswers.userId))
    .where(and(eq(userPersonaAnswers.fieldKey, field.fieldKey), countedUserWhere()))
    .groupBy(userPersonaAnswers.value)
    .having(sql`count(*) < ${minBucket}`)
    .as('withheld');

  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(withheld);
  return row?.n ?? 0;
}

function unavailableDistribution(
  field: PersonaMetricsField,
  reason: PersonaUnavailableReason,
  asOf: string | null,
  quantum: number,
): PersonaDistribution {
  return {
    field: field.fieldKey,
    label: field.label,
    items: [],
    suppressed: 0,
    quantum,
    available: false,
    reason,
    asOf,
  };
}

/**
 * Turn cleared buckets into a payload. Shared by the live path and the rollup
 * path so the two cannot disagree about what is publishable.
 *
 * Guarantee 6, whole-field suppression: when any bucket was withheld and the
 * field is SCALAR (select, radio, checkbox), every answer belongs to exactly one
 * bucket, so the visible buckets plus the field's option list bound the hidden
 * one. The whole field is refused rather than published partially. For a
 * multiselect the buckets do not partition the population, so a partial list with
 * a bare withheld-bucket count is safe.
 *
 * The refused payload reports `suppressed: 0`, not the real figure: on an
 * eighteen-option field "twelve withheld" plus three visible tells you fifteen
 * options had between one and k-1 people, which is the shape disclosure the
 * refusal exists to prevent. `reason` already says buckets were withheld.
 */
export function assemblePersonaDistribution(input: {
  field: PersonaMetricsField;
  buckets: readonly RawBucket[];
  suppressedBuckets: number;
  minBucket: number;
  asOf: string | null;
  limit?: number;
}): PersonaDistribution {
  const { field, minBucket, asOf } = input;

  // RE-APPLY the floor on read. Suppression and quantisation happen at write, so
  // a stored day computed under `minBucket: 5` keeps serving a 5 after the
  // operator raises the floor to 20 while the payload's own `quantum` claims 20:
  // a published count more precise than the k-anonymity statement it is making.
  // A bucket that no longer clears the floor becomes a withheld bucket, exactly
  // as it would have been at write time.
  const cleared = input.buckets.filter((b) => b.count >= minBucket);
  const suppressedBuckets = input.suppressedBuckets + (input.buckets.length - cleared.length);

  if (suppressedBuckets > 0 && field.cardinality === 'scalar') {
    return unavailableDistribution(field, 'insufficient_bucket_diversity', asOf, minBucket);
  }

  const labels = new Map(field.options.map((o) => [o.value, o.label]));
  const ordered = [...cleared].sort(
    (a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0),
  );
  const limited = input.limit === undefined ? ordered : ordered.slice(0, input.limit);

  return {
    field: field.fieldKey,
    label: field.label,
    items: limited.map((b) => ({
      value: b.value,
      // A checkbox has no option list; its single bucket is "people who ticked
      // it", so the stored value is its own label.
      label: labels.get(b.value) ?? b.value,
      count: quantisePersonaCount(b.count, minBucket),
    })),
    suppressed: suppressedBuckets,
    quantum: minBucket,
    available: true,
    asOf,
  };
}

/**
 * What every read on this surface needs, and nothing more.
 *
 * THERE IS NO `scopeDigest` HERE and it was removed rather than left unused
 * (R3.3). A consent digest on the input of a query that no longer joins consent
 * would be a parameter every caller has to supply, every reader has to reason
 * about, and nothing reads. The audience path is the one place a digest still
 * decides anything, and it takes its digests from `offeredPurposes`, where each
 * one sits beside the purpose it binds.
 */
export interface PersonaReadInput {
  thresholds: PersonaMetricsThresholds;
  /**
   * `'rollup'` serves a finalised UTC day and is what every public endpoint uses:
   * polling a live count lets a caller observe the exact moment a bucket crosses
   * the floor from below, which identifies that one person. `'live'` is the
   * admin path and reports `asOf: null` because it is a moment, not a day.
   */
  source: 'rollup' | 'live';
}

export async function getPersonaFieldDistribution(
  db: DB,
  input: PersonaReadInput & { field: PersonaMetricsField; limit: number },
): Promise<PersonaDistribution> {
  const { minBucket, minPopulation } = input.thresholds;
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit)));

  if (input.source === 'rollup') {
    const snapshot = await latestFinalisedSnapshot(db);
    if (!snapshot) return unavailableDistribution(input.field, 'no_snapshot_yet', null, minBucket);
    const refused = snapshotUnavailableReason(snapshot, minPopulation, utcDayKey());
    if (refused !== null) {
      return unavailableDistribution(input.field, refused, snapshot.day, minBucket);
    }
    const stored = await readStoredBuckets(db, snapshot.day, personaFieldMetric(input.field.fieldKey));
    return assemblePersonaDistribution({
      field: input.field,
      buckets: stored.buckets,
      suppressedBuckets: stored.suppressed,
      minBucket,
      asOf: snapshot.day,
      limit,
    });
  }

  const population = await countedPopulation(db);
  if (population < minPopulation) {
    return unavailableDistribution(input.field, 'insufficient_population', null, minBucket);
  }

  const [buckets, suppressedBuckets] = await Promise.all([
    liveFieldBuckets(db, input.field, minBucket, limit),
    liveFieldSuppressedBuckets(db, input.field, minBucket),
  ]);

  return assemblePersonaDistribution({
    field: input.field,
    buckets,
    suppressedBuckets,
    minBucket,
    asOf: null,
    limit,
  });
}

// --- Link presence --------------------------------------------------------------

/**
 * Link presence is computed from `users.social_links`, a jsonb key-existence
 * count, because v1 deliberately does NOT normalise those seven keys into a
 * `user_profile_links` table (plan 14.4: that cutover changes the public API
 * serializer, the DSAR allow-list, the profile DTO, the settings form and the
 * Drizzle type, for query speed a once-a-day rollup makes moot).
 *
 * So this is an unindexed scan over `users`. It runs ONCE A DAY in the rollup
 * pass and never on a public request, which is what makes that acceptable. If it
 * ever moves onto a per-request path, normalise the table first.
 *
 * `jsonb_typeof(...) = 'object'` is not optional (audit B12): `jsonb_each_text`
 * errors on a non-object jsonb value, and one bad legacy row would fail the whole
 * pass. Guarding inside the function argument rather than in WHERE means the
 * guard cannot be reordered past the expansion by the planner.
 *
 * INTERSECTED WITH `user_shared_links` (plan phase 3, D6). A platform counts for
 * a member only when they have a row saying they share that platform, so the
 * count is of people who both list it and chose to share it, never of everyone
 * who happens to have typed a URL in. The row-present-means-shared table has no
 * default to flip, so a member who has never touched the control contributes to
 * nothing here. This is the same intersection the directory applies to the link
 * PROJECTION, and it is deliberate that the aggregate and the disclosure agree:
 * one control, honoured in both places, is the only version a member can hold in
 * their head.
 */
function linkPresenceCte(platformKeys: readonly string[]) {
  const keyList = sql.join(
    platformKeys.map((k) => sql`${k}`),
    sql`, `,
  );
  return sql`
    WITH presence AS (
      SELECT e.k AS platform, count(*)::int AS n
      FROM ${users}
      CROSS JOIN LATERAL jsonb_each_text(
        CASE WHEN jsonb_typeof(${users.socialLinks}) = 'object'
             THEN ${users.socialLinks}
             ELSE '{}'::jsonb END
      ) AS e(k, v)
      WHERE ${countedUserWhere()}
        AND e.v <> ''
        AND e.k IN (${keyList})
        AND EXISTS (
          SELECT 1 FROM ${userSharedLinks}
          WHERE ${userSharedLinks.userId} = ${users.id}
            AND ${userSharedLinks.platform} = e.k
        )
      GROUP BY e.k
    )
  `;
}

/**
 * The data class link presence actually reads, and the declaration that
 * authorises it.
 *
 * `covers` used to be declared, digested, shown to the user and then never
 * enforced, which is exactly where it went wrong: link presence aggregated
 * `users.social_links` (the `profile_links` class) off a grant whose `covers`
 * listed only `persona_selections` and whose copy named only interests and tech
 * stack. Reading the declaration here makes it load bearing. What it now reads
 * is `PERSONA_STATISTICS.covers`, because this aggregate is statistics rather
 * than consent: if a future edit narrows what the statistics copy says is
 * counted, this surface goes dark instead of quietly outrunning it.
 */
const LINK_PRESENCE_DATA_CLASS: PersonaDataClass = 'profile_links';
const STATISTICS_COVERS_LINKS = statisticsCovers(LINK_PRESENCE_DATA_CLASS);

async function liveLinkPresence(
  db: DB,
  platforms: readonly PersonaLinkPlatformSpec[],
  minBucket: number,
): Promise<{ buckets: RawBucket[]; suppressed: number }> {
  const keys = platforms.map((p) => p.key);
  if (keys.length === 0) return { buckets: [], suppressed: 0 };

  const cte = linkPresenceCte(keys);
  const visibleRes = await db.execute(
    sql`${cte} SELECT platform, n FROM presence WHERE n >= ${minBucket} ORDER BY n DESC, platform ASC`,
  );
  const withheldRes = await db.execute(
    sql`${cte} SELECT count(*)::int AS n FROM presence WHERE n < ${minBucket}`,
  );

  const visible = rowsOf<{ platform: string; n: number }>(visibleRes);
  const withheld = rowsOf<{ n: number }>(withheldRes);

  return {
    buckets: visible.map((r) => ({ value: r.platform, count: Number(r.n) })),
    suppressed: Number(withheld[0]?.n ?? 0),
  };
}

function assembleLinkPresence(input: {
  platforms: readonly PersonaLinkPlatformSpec[];
  buckets: readonly RawBucket[];
  suppressedBuckets: number;
  minBucket: number;
  asOf: string | null;
}): PersonaLinkPresence {
  const byKey = new Map(input.platforms.map((p) => [p.key, p]));
  // Re-apply the floor on read, for the reason given in
  // `assemblePersonaDistribution`: a stored day was floored under the thresholds
  // in force when it was written, not the ones the payload now declares.
  const cleared = input.buckets.filter((b) => b.count >= input.minBucket);
  const suppressedBuckets = input.suppressedBuckets + (input.buckets.length - cleared.length);
  const ordered = [...cleared].sort(
    (a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0),
  );
  return {
    items: ordered.flatMap((b) => {
      const platform = byKey.get(b.value);
      // A platform the operator has since removed keeps its rows in a finalised
      // day. Drop it rather than invent a label.
      if (!platform) return [];
      return [
        {
          platform: platform.key,
          label: platform.label,
          count: quantisePersonaCount(b.count, input.minBucket),
          // A REGISTRY FACT, not a hardcoded platform list inside a query: an
          // operator who adds a platform decides its signal status where they
          // name it.
          authenticitySignal: platform.authenticitySignal,
        },
      ];
    }),
    suppressed: suppressedBuckets,
    quantum: input.minBucket,
    available: true,
    asOf: input.asOf,
  };
}

function unavailableLinkPresence(
  reason: PersonaUnavailableReason,
  asOf: string | null,
  quantum: number,
): PersonaLinkPresence {
  return { items: [], suppressed: 0, quantum, available: false, reason, asOf };
}

export async function getPersonaLinkPresence(
  db: DB,
  input: PersonaReadInput & { platforms: readonly PersonaLinkPlatformSpec[] },
): Promise<PersonaLinkPresence> {
  const { minBucket, minPopulation } = input.thresholds;

  // The statistics declaration must cover the class this reads. See
  // LINK_PRESENCE_DATA_CLASS.
  if (!STATISTICS_COVERS_LINKS) {
    return unavailableLinkPresence('statistics_not_covered', null, minBucket);
  }

  if (input.source === 'rollup') {
    const snapshot = await latestFinalisedSnapshot(db);
    if (!snapshot) return unavailableLinkPresence('no_snapshot_yet', null, minBucket);
    const refused = snapshotUnavailableReason(snapshot, minPopulation, utcDayKey());
    if (refused !== null) return unavailableLinkPresence(refused, snapshot.day, minBucket);
    const stored = await readStoredBuckets(db, snapshot.day, PERSONA_LINK_METRIC);
    return assembleLinkPresence({
      platforms: input.platforms,
      buckets: stored.buckets,
      suppressedBuckets: stored.suppressed,
      minBucket,
      asOf: snapshot.day,
    });
  }

  const population = await countedPopulation(db);
  if (population < minPopulation) {
    return unavailableLinkPresence('insufficient_population', null, minBucket);
  }

  const live = await liveLinkPresence(db, input.platforms, minBucket);
  return assembleLinkPresence({
    platforms: input.platforms,
    buckets: live.buckets,
    suppressedBuckets: live.suppressed,
    minBucket,
    asOf: null,
  });
}

// --- Audience counts ------------------------------------------------------------

/**
 * A purpose the operator currently offers, with the digest a grant for it must
 * carry. The caller derives this from `purposeIsOfferable`; a purpose absent from
 * the list is reported as `purpose_not_offered` and NEVER as a zero.
 */
export interface OfferedPurpose {
  purpose: ProcessingPurposeId;
  scopeDigest: string;
}

/**
 * How many counted members hold a current, digest-matching grant for one purpose.
 *
 * ONE JOIN, WHERE THERE USED TO BE TWO. The second leg was a `profile_analytics`
 * grant, on the argument that only the analytics copy said "your answers are
 * counted in group totals", so counting a recruiter-grant holder into a total
 * nobody had described to them was the thing the double join prevented. That
 * argument survives the correction; what changed is which instrument carries it.
 * The statistics copy now describes the counting to everybody, and the member
 * who does not want it says so with an objection, which is exactly what
 * {@link countedUserWhere} excludes. So the analytics leg is not dropped, it is
 * replaced by the anti-join, and an objector is absent from this count as they
 * are from every other one in this file.
 */
async function audienceGrantCount(db: DB, offered: OfferedPurpose): Promise<number> {
  const consents = alias(userPurposeConsents, 'caud');
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(consents, currentGrant(consents, offered.purpose, offered.scopeDigest))
    .where(countedUserWhere());
  return row?.n ?? 0;
}

/**
 * Every per-purpose slot carries the SAME reason as the payload, so a consumer
 * reading one field in isolation is told why rather than being told the purpose
 * is not offered when in truth the whole surface is dark.
 */
function unavailableAudience(
  reason: PersonaAudienceUnavailableReason,
  asOf: string | null,
  quantum: number,
): PersonaAudienceCounts {
  const slot: PersonaAudienceCount = { available: false, reason };
  return {
    ...audienceSlots(() => slot),
    quantum,
    available: false,
    reason,
    asOf,
  };
}

export async function getAudienceCounts(
  db: DB,
  input: PersonaReadInput & { offeredPurposes: readonly OfferedPurpose[] },
): Promise<PersonaAudienceCounts> {
  const { minBucket, minPopulation } = input.thresholds;
  const offered = new Map(input.offeredPurposes.map((p) => [p.purpose, p]));

  if (input.source === 'rollup') {
    const snapshot = await latestFinalisedSnapshot(db);
    if (!snapshot) return unavailableAudience('no_snapshot_yet', null, minBucket);
    const refused = snapshotUnavailableReason(snapshot, minPopulation, utcDayKey());
    if (refused !== null) return unavailableAudience(refused, snapshot.day, minBucket);

    const stored = await readStoredAudience(db, snapshot.day);
    return {
      ...audienceSlots((purpose) => {
        const entry = offered.get(purpose);
        if (entry === undefined) return PURPOSE_NOT_OFFERED;
        // THE DIGEST GUARD, and the only surface that still needs one. A stored
        // count of grant holders is worth exactly what the grants behind it are
        // worth: a day computed before the operator added a recipient counts
        // people whose grants now authorise nothing. A day that cannot say which
        // scope it was computed under (`null`) is treated as a mismatch, because
        // a figure that cannot prove its own basis is not servable.
        if (snapshot.scopeDigest === null || snapshot.scopeDigest !== entry.scopeDigest) {
          return { available: false, reason: 'scope_changed' };
        }
        const value = stored.get(purpose);
        // No stored row means the purpose was not offered when that day was
        // computed, which is what the reason says. Quantised at write.
        return value === undefined ? PURPOSE_NOT_OFFERED : { available: true, count: value };
      }),
      quantum: minBucket,
      available: true,
      asOf: snapshot.day,
    };
  }

  const population = await countedPopulation(db);
  if (population < minPopulation) {
    return unavailableAudience('insufficient_population', null, minBucket);
  }

  // One join per offered purpose, driven by the registry so the third purpose
  // R3.6 describes how to add needs no edit here.
  const counts = new Map<ProcessingPurposeId, number>();
  await Promise.all(
    PROCESSING_PURPOSES.map(async (purpose) => {
      const entry = offered.get(purpose);
      if (entry === undefined) return;
      counts.set(purpose, await audienceGrantCount(db, entry));
    }),
  );

  return {
    ...audienceSlots((purpose) => {
      const value = counts.get(purpose);
      return value === undefined
        ? PURPOSE_NOT_OFFERED
        : { available: true, count: quantisePersonaCount(value, minBucket) };
    }),
    quantum: minBucket,
    available: true,
    asOf: null,
  };
}

// --- Snapshot reads -------------------------------------------------------------

interface PersonaSnapshot {
  day: string;
  /** Already quantised at write. */
  population: number;
  /** True when the day was written below the population floor. */
  populationSuppressed: boolean;
  /**
   * The consent scope digest this day's AUDIENCE counts were computed under, or
   * null when the day carries no audience figures (no purpose was offered) or
   * predates the marker. Only {@link getAudienceCounts} reads it; a null is a
   * mismatch there, because a grant count that cannot prove its own basis is not
   * servable. The distributions and link presence on the same day are unaffected,
   * having no consent basis to prove.
   */
  scopeDigest: string | null;
}

/**
 * The reasons a finalised day is refused WHOLESALE, on every surface.
 *
 * Narrow on purpose, and narrower than either payload's reason union, so both
 * accept it without a mapping step. `scope_changed` is not here any more: it is
 * a per-purpose verdict on the audience payload alone and is decided there.
 */
type SnapshotRefusal = 'insufficient_population' | 'no_snapshot_yet';

/**
 * Can this finalised day be published against the CURRENT floors?
 *
 * Two ways a stored day stops being servable, both of which the read path used
 * to ignore because suppression and quantisation are applied at write:
 *
 * - the day is older than {@link PERSONA_SNAPSHOT_MAX_AGE_DAYS};
 * - the operator RAISED `minPopulation`, so a population that cleared the old
 *   floor no longer clears this one.
 *
 * There were four. The scope check moved to the audience slots, where the
 * consent it speaks about still lives, and the "no purpose authorised counting"
 * marker is gone entirely: statistics no longer wait on a purpose, so a day with
 * no offerable purpose still has real distributions on it and darkening the
 * whole thing would now be a lie about the data rather than a protection of it.
 */
function snapshotUnavailableReason(
  snapshot: PersonaSnapshot,
  minPopulation: number,
  today: string,
): SnapshotRefusal | null {
  if (daysBetweenUtcDays(snapshot.day, today) > PERSONA_SNAPSHOT_MAX_AGE_DAYS) {
    return 'no_snapshot_yet';
  }
  if (snapshot.populationSuppressed || snapshot.population < minPopulation) {
    return 'insufficient_population';
  }
  return null;
}

/** Whole UTC days between two `YYYY-MM-DD` keys. Negative when `to` precedes `from`. */
function daysBetweenUtcDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The most recent FINALISED UTC day, or null when the instance has never
 * completed one.
 *
 * The presence of this row is what "there is a snapshot" means, so a day where
 * the population floor was not met still writes it (with `suppressed = true`) and
 * the surface reports `insufficient_population` rather than `no_snapshot_yet`.
 * The two are different answers and an operator needs to tell them apart.
 */
export async function latestFinalisedSnapshot(db: DB): Promise<PersonaSnapshot | null> {
  const [row] = await db
    .select({
      day: personaMetricsDaily.day,
      value: personaMetricsDaily.value,
      suppressed: personaMetricsDaily.suppressed,
    })
    .from(personaMetricsDaily)
    .where(
      and(
        eq(personaMetricsDaily.metric, PERSONA_METRIC_META),
        eq(personaMetricsDaily.dimension, PERSONA_META_POPULATION),
        eq(personaMetricsDaily.final, true),
      ),
    )
    .orderBy(desc(personaMetricsDaily.day))
    .limit(1);

  if (!row) return null;

  // The other meta row for the same day: the consent scope digest the audience
  // counts were computed under. A dimension rather than a sentinel VALUE;
  // session 254 removed the last `-1` sentinel from this codebase and it is not
  // coming back.
  const meta = await db
    .select({ dimension: personaMetricsDaily.dimension })
    .from(personaMetricsDaily)
    .where(
      and(
        eq(personaMetricsDaily.day, row.day),
        eq(personaMetricsDaily.metric, PERSONA_METRIC_META),
      ),
    );

  const scopeRow = meta.find((m) => m.dimension.startsWith(PERSONA_META_SCOPE_PREFIX));
  return {
    day: row.day,
    population: Number(row.value),
    populationSuppressed: row.suppressed,
    scopeDigest:
      scopeRow === undefined
        ? null
        : scopeRow.dimension.slice(PERSONA_META_SCOPE_PREFIX.length),
  };
}

async function readStoredBuckets(
  db: DB,
  day: string,
  metric: string,
): Promise<{ buckets: RawBucket[]; suppressed: number }> {
  const rows = await db
    .select({
      dimension: personaMetricsDaily.dimension,
      value: personaMetricsDaily.value,
    })
    .from(personaMetricsDaily)
    .where(and(eq(personaMetricsDaily.day, day), eq(personaMetricsDaily.metric, metric)));

  let suppressed = 0;
  const buckets: RawBucket[] = [];
  for (const r of rows) {
    if (r.dimension === PERSONA_SUPPRESSED_DIMENSION) {
      suppressed = Number(r.value);
      continue;
    }
    buckets.push({ value: r.dimension, count: Number(r.value) });
  }
  return { buckets, suppressed };
}

async function readStoredAudience(
  db: DB,
  day: string,
): Promise<Map<ProcessingPurposeId, number>> {
  const rows = await db
    .select({ metric: personaMetricsDaily.metric, value: personaMetricsDaily.value })
    .from(personaMetricsDaily)
    .where(
      and(
        eq(personaMetricsDaily.day, day),
        eq(personaMetricsDaily.dimension, PERSONA_AUDIENCE_DIMENSION),
      ),
    );

  // Inverted from `personaAudienceMetric` rather than re-derived from a string
  // literal, so the writer and the reader cannot drift.
  const byMetric = new Map<string, ProcessingPurposeId>(
    PROCESSING_PURPOSES.map((p) => [personaAudienceMetric(p), p]),
  );
  const out = new Map<ProcessingPurposeId, number>();
  for (const r of rows) {
    const purpose = byMetric.get(r.metric);
    if (purpose) out.set(purpose, Number(r.value));
  }
  return out;
}

// --- Rollup ---------------------------------------------------------------------

export interface PersonaRollupInput {
  /**
   * The UTC day the computed rows are FILED UNDER, `YYYY-MM-DD`. A label, not a
   * query predicate.
   *
   * Nothing this pass reads carries an as-of dimension: `user_persona_answers`
   * has a `created_at` but an answer that was edited yesterday looks like
   * today's, and `users.social_links` has none at all. So "yesterday's row" is
   * the state at the moment the worker closed yesterday out, not a
   * reconstruction of yesterday. Naming it `day` and passing it into the compute
   * step read as time-scoping and was not; the compute step no longer takes it.
   */
  day: string;
  fields: readonly PersonaMetricsField[];
  platforms: readonly PersonaLinkPlatformSpec[];
  thresholds: PersonaMetricsThresholds;
  /**
   * Offered purposes and their digests, for the audience counts alone. An empty
   * list is a normal instance: it writes the distributions and the link presence
   * exactly as it would otherwise, and no audience rows. Nothing here gates the
   * statistics any more.
   */
  offeredPurposes: readonly OfferedPurpose[];
}

export interface PersonaRollupResult {
  day: string;
  rowsWritten: number;
  /** The day that was closed out on this run, or null when there was none to close. */
  finalisedDay: string | null;
  finalisedRows: number;
}

interface PersonaMetricRow {
  metric: string;
  dimension: string;
  value: number;
  suppressed: boolean;
}

/** Hard ceiling on buckets stored for one field on one day. See its use site. */
const ROLLUP_BUCKET_CAP = 1000;

/** The UTC day before `day`, `YYYY-MM-DD` in and out. */
export function previousUtcDay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Today as a UTC day key. Day keys are UTC everywhere in this module. */
export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Compute one day's persona rows.
 *
 * SUPPRESSION AND QUANTISATION ARE APPLIED AT WRITE, so the rollup table itself
 * never stores a re-identifying count and the series cannot be differenced across
 * days to recover a small bucket. Revocation therefore never requires rewriting
 * history.
 *
 * Below the population floor the pass writes ONE row: the meta marker, flagged
 * suppressed. No field, link or audience row is computed at all, so a thin
 * instance stores nothing that a later floor change could expose.
 */
async function computePersonaRows(
  db: DB,
  input: Omit<PersonaRollupInput, 'day'>,
): Promise<PersonaMetricRow[]> {
  const { minBucket, minPopulation } = input.thresholds;

  // THE digest this day's AUDIENCE counts are computed under. Written first so
  // it is present on every stored day including a suppressed one: an audience
  // figure that cannot say which grants produced it is refused on read rather
  // than trusted.
  //
  // Every caller derives all of these from ONE `currentPurposeScope`, so the set
  // is a singleton in practice. If a future caller ever mixes scopes in one
  // pass, no row is written and every audience slot reads `scope_changed`, which
  // fails in the direction of publishing nothing rather than publishing a count
  // under a scope the day cannot name.
  const digests = new Set(input.offeredPurposes.map((p) => p.scopeDigest));
  const scopeRows: PersonaMetricRow[] = digests.size === 1
    ? [{
      metric: PERSONA_METRIC_META,
      dimension: personaScopeDimension([...digests][0]!),
      value: 0,
      suppressed: false,
    }]
    : [];

  const population = await countedPopulation(db);
  if (population < minPopulation) {
    return [
      ...scopeRows,
      { metric: PERSONA_METRIC_META, dimension: PERSONA_META_POPULATION, value: 0, suppressed: true },
    ];
  }

  const rows: PersonaMetricRow[] = [
    ...scopeRows,
    {
      metric: PERSONA_METRIC_META,
      dimension: PERSONA_META_POPULATION,
      value: quantisePersonaCount(population, minBucket),
      suppressed: false,
    },
  ];

  for (const field of input.fields) {
    const metric = personaFieldMetric(field.fieldKey);
    const [buckets, suppressedBuckets] = await Promise.all([
      // The endpoint's `limit` is a presentation concern; truncating at write
      // would make the stored day depend on who asked first. The cap is well
      // above `PERSONA_MAX_AGGREGATABLE_BUCKETS` (120 for a whole template, and
      // at most 64 options on one field), so it never truncates in practice and
      // exists only so a corrupted template cannot produce an unbounded read.
      liveFieldBuckets(db, field, minBucket, ROLLUP_BUCKET_CAP),
      liveFieldSuppressedBuckets(db, field, minBucket),
    ]);

    if (suppressedBuckets > 0) {
      rows.push({
        metric,
        dimension: PERSONA_SUPPRESSED_DIMENSION,
        value: suppressedBuckets,
        suppressed: true,
      });
    }
    // Guarantee 6 applied at WRITE for a scalar field: the visible buckets are
    // not stored at all, so the finalised day cannot be read back into the
    // partial list the read path would refuse to serve.
    if (suppressedBuckets > 0 && field.cardinality === 'scalar') continue;

    for (const b of buckets) {
      rows.push({
        metric,
        dimension: b.value,
        value: quantisePersonaCount(b.count, minBucket),
        suppressed: false,
      });
    }
  }

  if (input.platforms.length > 0 && STATISTICS_COVERS_LINKS) {
    const links = await liveLinkPresence(db, input.platforms, minBucket);
    if (links.suppressed > 0) {
      rows.push({
        metric: PERSONA_LINK_METRIC,
        dimension: PERSONA_SUPPRESSED_DIMENSION,
        value: links.suppressed,
        suppressed: true,
      });
    }
    for (const b of links.buckets) {
      rows.push({
        metric: PERSONA_LINK_METRIC,
        dimension: b.value,
        value: quantisePersonaCount(b.count, minBucket),
        suppressed: false,
      });
    }
  }

  for (const purpose of input.offeredPurposes) {
    const n = await audienceGrantCount(db, purpose);
    rows.push({
      metric: personaAudienceMetric(purpose.purpose),
      dimension: PERSONA_AUDIENCE_DIMENSION,
      value: quantisePersonaCount(n, minBucket),
      suppressed: false,
    });
  }

  return rows;
}

/**
 * Replace a day's rows wholesale, in one transaction.
 *
 * A delete-then-insert rather than an upsert, because an upsert leaves behind any
 * dimension that cleared the floor yesterday and does not today: the stale row
 * would keep being served as if it were current, which is exactly the bucket a
 * revocation was supposed to remove.
 */
async function writePersonaDay(
  db: DB,
  day: string,
  final: boolean,
  rows: readonly PersonaMetricRow[],
): Promise<number> {
  await db.transaction(async (tx) => {
    await tx.delete(personaMetricsDaily).where(eq(personaMetricsDaily.day, day));
    if (rows.length > 0) {
      await tx.insert(personaMetricsDaily).values(
        rows.map((r) => ({
          day,
          metric: r.metric,
          dimension: r.dimension,
          value: r.value,
          suppressed: r.suppressed,
          final,
        })),
      );
    }
  });
  return rows.length;
}

/**
 * The persona rollup pass. A Nitro plugin calls this; `runDailyRollup` in
 * `publicApi/metricsRollup.ts` is NOT edited and knows nothing about persona
 * (plan 14.4), which is what keeps the shared timeseries surface free of persona
 * rows and its body free of a feature-specific branch.
 *
 * Two behaviours worth stating out loud:
 *
 * - **Day keys are UTC**, everywhere, with no operator timezone anywhere near them.
 * - **End-of-day finalisation.** The existing worker only ever upserts *today* and
 *   never writes a "yesterday is final" row, so the public endpoints would have
 *   nothing to serve. On every run, if yesterday has rows and none of them are
 *   final, yesterday is recomputed and written with `final = true`. If yesterday
 *   has no rows at all (the instance was down, or the feature was only just
 *   enabled) nothing is written and the endpoints say `no_snapshot_yet` rather
 *   than inventing a day.
 */
export async function runPersonaRollup(
  db: DB,
  input: PersonaRollupInput,
): Promise<PersonaRollupResult> {
  const todayRows = await computePersonaRows(db, input);
  const rowsWritten = await writePersonaDay(db, input.day, false, todayRows);

  const previous = previousUtcDay(input.day);
  const [state] = await db
    .select({
      total: sql<number>`count(*)::int`,
      finals: sql<number>`count(*) FILTER (WHERE ${personaMetricsDaily.final})::int`,
    })
    .from(personaMetricsDaily)
    .where(eq(personaMetricsDaily.day, previous));

  const total = state?.total ?? 0;
  const finals = state?.finals ?? 0;
  if (total === 0 || finals > 0) {
    return { day: input.day, rowsWritten, finalisedDay: null, finalisedRows: 0 };
  }

  // No `day` is passed: `computePersonaRows` reads CURRENT state and always did.
  // Spreading `{ ...input, day: previous }` into it read as time-scoping and was
  // a no-op, which is worse than not scoping at all because the next reader
  // believes the series is one.
  const previousRows = await computePersonaRows(db, input);
  const finalisedRows = await writePersonaDay(db, previous, true, previousRows);
  return { day: input.day, rowsWritten, finalisedDay: previous, finalisedRows };
}
