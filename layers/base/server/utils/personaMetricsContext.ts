/**
 * The resolution every persona metrics route has to do before it can ask a
 * question, in one place.
 *
 * Six routes (four public, one admin, one rollup plugin) each need the same
 * four things: the effective persona schema, the countable field list, the live
 * consent scope, and the k-anonymity thresholds. Repeating that block six times
 * is not a style problem. Each of those steps is a gate, and a route that
 * resolved the scope slightly differently would compute a digest the analytics
 * join does not match, which fails closed and silently returns nothing.
 *
 * Two rules the block encodes, both easy to get subtly wrong by hand:
 *
 * 1. The countable field list is the INTERSECTION of
 *    `listPersonaAggregatableFields` (which has already dropped sensitive,
 *    retired and drifted-but-unacknowledged keys) and `personaMetricsFields`
 *    (which supplies the cardinality). Neither list can widen the surface on its
 *    own, and the rollup writes exactly what the routes will serve.
 * 2. `currentPurposeScope` gets the RESOLVED sections, not the config file's.
 *    The default resolver reads the file, so a caller who omits this computes
 *    the digest over file sections while the aggregation counts DB-resolved
 *    ones.
 *
 * NOT under `server/api/**`: Nitro would register it as a route. Nitro routes
 * also do not auto-import from `utils/`, so callers import this by relative
 * path.
 *
 * BY RIGHTS THIS BELONGS IN `@commonpub/server`, next to the functions it
 * sequences: every step is a gate, so it is domain logic rather than route glue,
 * and a fork adding its own persona metrics route currently has to reach into
 * the layer by relative path or re-derive the sequence by hand. The move was
 * tried and reverted, and the blocker is worth recording: every route test in
 * this tree stubs the persona resolution with `vi.mock('@commonpub/server')`,
 * and a module INSIDE that package reaches its dependencies by relative import,
 * so the stubs stop applying and the tests would have to hand-assemble the
 * context they exist to check the routes agree on. Moving it needs those tests
 * restructured first.
 */
import {
  currentPurposeScope,
  effectiveDataSharingDocument,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  listPersonaAggregatableFields,
  personaMetricsFields,
  resolvePersonaThresholds,
  type PersonaLinkPlatformSpec,
  type PersonaMetricsField,
  type PersonaMetricsThresholds,
  type PersonaSection,
  type PurposeScope,
} from '@commonpub/server';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '@commonpub/server';

export interface PersonaMetricsContext {
  /** The effective schema, after DB-over-file-over-builtin precedence. */
  sections: readonly PersonaSection[];
  /** Countable fields: the intersection described above, in schema order. */
  fields: PersonaMetricsField[];
  /**
   * The effective link platforms. Resolved here rather than per route because
   * the link presence counts and the rollup that writes them must agree on the
   * platform set; a route that resolved a different set would publish a
   * `suppressed` count against a different denominator.
   */
  platforms: readonly PersonaLinkPlatformSpec[];
  /** The live consent scope. Its digest is what the aggregation binds grants to. */
  scope: PurposeScope;
  /** Operator thresholds, clamped up to the constants in `@commonpub/persona`. */
  thresholds: PersonaMetricsThresholds;
}

export async function personaMetricsContext(
  db: DB,
  config: CommonPubConfig,
): Promise<PersonaMetricsContext> {
  const [{ sections }, allowed, platforms] = await Promise.all([
    effectivePersonaSchema(db, config),
    listPersonaAggregatableFields(db, config),
    effectivePersonaLinkPlatforms(db, config),
  ]);

  const allowedKeys = new Set(allowed.map((f) => f.key));
  const fields = personaMetricsFields(sections).filter((f) => allowedKeys.has(f.fieldKey));

  // Both resolvers, for the same reason. The default `dataSharing` resolver
  // reads the config file, but the effective recipient list is the file UNION
  // the ones an operator added through `/admin/data-sharing`. A digest over the
  // file half alone would disagree with the one the consent routes record a
  // grant against the moment a recipient is stored in the database, and the
  // aggregates would then count nobody, silently and fail-closed.
  const scope = await currentPurposeScope(db, config, {
    sections: async () => sections,
    dataSharing: effectiveDataSharingDocument,
  });
  const thresholds = resolvePersonaThresholds({
    minBucket: scope.minBucket,
    minPopulation: scope.minPopulation,
  });

  return { sections, fields, platforms, scope, thresholds };
}
