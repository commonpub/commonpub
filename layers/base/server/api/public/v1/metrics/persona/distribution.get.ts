/**
 * GET /api/public/v1/metrics/persona/distribution?field=interests&limit=20
 *
 * Scope: `read:audience`. One countable field's bucket distribution, from the
 * most recent FINALISED UTC day (plan 7.2, 7.3, 7.4).
 *
 * What is NOT in the response, and why:
 *
 * - NO `eligibleUsers`, `total` or `population`. Publishing the population next
 *   to the visible buckets is a differencing oracle: for a single-valued field
 *   the quantised counts plus a near-exact total bound the residual, and with one
 *   suppressed bucket the hidden count is recoverable to within a quantum. The
 *   population figure appears only on `/persona/audience`, quantised.
 * - NO live read. This serves a completed day, because polling a live endpoint
 *   hourly lets a caller observe the exact moment a bucket crosses the floor from
 *   below, which identifies that one person.
 * - NO cross-tabulation, ever, by any query parameter. A two-dimensional
 *   breakdown over a few hundred people re-identifies trivially even above k=5.
 *   Any future cross-tab needs a much higher threshold, a query budget or a noise
 *   model, plus its own flag.
 *
 * `field` is validated against the same intersection `/persona/fields` publishes,
 * so an arbitrary key is a clean 400 and never reaches a SQL bind. Validate the
 * domain, not the shape.
 */
import { getPersonaFieldDistribution, type PersonaDistribution } from '@commonpub/server';

// Relative, not auto-imported: Nitro routes do not auto-import from `utils/`.
import { personaMetricsContext } from '../../../../../utils/personaMetricsContext';

import { z } from 'zod';

const querySchema = z.object({
  /** `^[a-z0-9_]{1,40}$` is the stored key alphabet; the domain check follows. */
  field: z.string().min(1).max(40),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default defineEventHandler(async (event): Promise<PersonaDistribution> => {
  requireFeature('persona');
  requireFeature('personaAnalytics');
  // NO `dataSharingConsents` gate, and its absence is deliberate. This surface
  // used to carry one because every count was a count of purpose GRANTS, so the
  // counting had to die with the surface that managed them. It no longer counts
  // grants: instance statistics run on legitimate interest and exclude anyone
  // who has objected, so requiring the sharing flag would force an operator who
  // wants public aggregates to switch on third-party sharing they do not do.
  // `persona` + `personaAnalytics` is the whole ladder for this endpoint.
  requireApiScope(event, 'read:audience');

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsed.error.flatten(),
    });
  }

  const db = useDB();
  const config = useConfig();

  // `fields` is the countable set: an unknown key and a real-but-not-countable
  // key (free text, a link, a column-bound field, a retired or drifted one) are
  // both simply absent from it, so both refuse before any query is issued.
  const { fields, thresholds } = await personaMetricsContext(db, config);
  const field = fields.find((f) => f.fieldKey === parsed.data.field);
  if (field === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown persona field: ${parsed.data.field}`,
    });
  }

  return await getPersonaFieldDistribution(db, {
    thresholds,
    source: 'rollup',
    field,
    limit: parsed.data.limit,
  });
});
