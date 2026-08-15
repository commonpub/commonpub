/**
 * The k-anonymity floors, in one place.
 *
 * Appendix B5: the plan's own prose said these constants were "referenced by the
 * Zod `.min()` calls" while the code block wrote the literals `.min(5)` and
 * `.min(20)`, because the constants lived in a package the schema could not
 * import. That is the plan violating its own "derive, do not declare twice"
 * rule. They live HERE, in the package every persona consumer already depends
 * on, and the Zod schemas reference them.
 *
 * ONE HONEST CAVEAT, because three documents used to claim this was fully
 * resolved and a fourth denied it: `packages/server/src/publicApi/metrics.ts`
 * STILL declares its own `METRICS_MIN_BUCKET = 5` for the Phase 2 content
 * metrics, which predate this package. There are two declarations, pinned equal
 * by `packages/server/src/publicApi/__tests__/minBucketParity.test.ts`, and
 * `packages/server/src/index.ts` carries an explicit re-export to disambiguate
 * the two star exports. Collapsing them is a follow-up on the Phase 2 surface,
 * not on persona. Persona's own module re-exports THESE and declares nothing.
 *
 * Both are FLOORS, never values. Every aggregation function takes the resolved
 * operator config numbers as parameters; an operator can raise them and cannot
 * dial them below these.
 */

/**
 * A published bucket must contain at least this many people. A bucket of 3 on a
 * 40 person instance re-identifies.
 */
export const METRICS_MIN_BUCKET = 5;

/**
 * The whole audience surface stays dark below this many counted members.
 * Repeated single-field marginals across 18 interests and 16 stack entries
 * narrow membership by intersection even when every individual bucket clears the
 * bucket floor, so a population floor is a separate defence, not a duplicate of
 * one.
 *
 * IT IS ALSO THE DEFENCE AGAINST THE DAILY-DIFFERENCING CHANNEL, which is worth
 * naming because the rollup's own comment overstates what serving a finalised
 * day buys. A caller polling `/metrics/persona/distribution` once a day sees a
 * bucket APPEAR on the day it crosses the floor, and `suppressed` drop by one
 * alongside it. That says one specific person joined that bucket that day, and
 * on a small instance the day is often enough to name them. Serving a finalised
 * day coarsens the observation from hourly to daily; it does not remove it.
 * Raising this number is what removes it, and an operator who publishes to
 * untrusted key holders should raise both floors well above these.
 */
export const MIN_AUDIENCE_POPULATION = 25;
