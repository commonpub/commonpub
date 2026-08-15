/**
 * GET /api/admin/persona-metrics
 *
 * The operator-facing audience dashboard (plan 7.4, last row).
 *
 * THE ADMIN DASHBOARD GETS NO EXEMPTION. It calls the same functions, with the
 * same consent inner join, the same k-anonymity floors, the same whole-field
 * suppression and the same downward quantisation as the public API. The consent
 * is with the member, not with the API: "3 people are interested in PCB design"
 * on a 40-person instance re-identifies somebody regardless of who is looking.
 *
 * The one difference is temporal, and it runs the other way. Public endpoints
 * serve a finalised UTC day, because polling a live count lets a caller watch the
 * exact moment a bucket crosses the floor from below, which identifies that one
 * person. An operator holding a session is not that caller, and an operator
 * tuning a schema needs to see the effect of a change before tomorrow, so this
 * route reads `source: 'live'` and reports `asOf: null` — a moment, not a day.
 *
 * `audience` is null unless `features.dataSharingConsents` is on, because the
 * purpose grants it counts cannot be given at all while that flag is off. A hard
 * zero there would read as "nobody opted in" when it means "nobody could".
 *
 * DELIBERATELY NOT gated on `dataSharingConsents` overall, unlike the four
 * public endpoints and the rollup plugin, which now die with it. Those PUBLISH;
 * this one shows an operator the state of their own instance, and an operator
 * who switched the disclosing surface off to revise recipient copy still needs
 * to see what is stored. Recorded so the asymmetry is a decision, not a gap.
 */
import {
  getPersonaFieldDistribution,
  getPersonaLinkPresence,
  getAudienceCounts,
  type PersonaAudienceCounts,
  type PersonaDistribution,
  type PersonaLinkPresence,
  type PersonaMetricsThresholds,
} from '@commonpub/server';

// Relative, not auto-imported: Nitro routes do not auto-import from `utils/`.
import { personaMetricsContext } from '../../utils/personaMetricsContext';
import { z } from 'zod';


/** How many distributions one request may ask for. */
const MAX_FIELDS_PER_REQUEST = 10;

const querySchema = z.object({
  /** One field. Kept for compatibility; prefer `fields`. */
  field: z.string().min(1).max(40).optional(),
  /**
   * Comma-separated field keys, up to {@link MAX_FIELDS_PER_REQUEST}.
   *
   * A dashboard answering "how many are interested in X" for every section
   * needed one request per field, and every one of those re-ran
   * `personaMetricsContext`: a fresh effective-schema resolution, a fresh scope
   * digest and a fresh threshold resolve. Eleven round trips and eleven digests
   * for one page load, each of which could in principle disagree. One context
   * serves them all.
   *
   * NO SHIPPED CALLER YET, stated so it is not mistaken for one.
   * `pages/admin/persona-metrics.vue` renders one field behind a picker and
   * uses `?field=`; batching would not save it a round trip, because the field
   * KEYS arrive in the first response, so nothing can name them earlier. This
   * parameter pays off for a screen that renders every field's answers at once,
   * which is a layout change nobody has been able to see in a browser yet. It is
   * kept rather than deleted because it is capped, domain-validated against the
   * server-resolved field list, and covered — so the next author of that screen
   * does not re-derive the cap and the validation, and does not meanwhile ship
   * eleven scope digests per page load.
   */
  fields: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface AdminPersonaMetricsField {
  sectionKey: string;
  fieldKey: string;
  label: string;
  multiValued: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export interface AdminPersonaMetricsResponse {
  fields: AdminPersonaMetricsField[];
  /** Present only when `?field=` names a countable field. */
  distribution: PersonaDistribution | null;
  /** One entry per key in `?fields=`, in the order requested. Empty when absent. */
  distributions: PersonaDistribution[];
  links: PersonaLinkPresence;
  audience: PersonaAudienceCounts | null;
  thresholds: PersonaMetricsThresholds;
  /** Published counts are floored to a multiple of this. */
  quantum: number;
  /** Always null here: a live read is a moment, not a finalised day. */
  asOf: null;
}

export default defineEventHandler(async (event): Promise<AdminPersonaMetricsResponse> => {
  requireFeature('admin');
  requireFeature('persona');
  requireFeature('personaAnalytics');
  requirePermission(event, 'audit.read');

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

  // The SAME resolution the public routes use, deliberately: an admin screen
  // that saw a wider field set or a looser threshold than the published API
  // would show an operator numbers no caller can get, and the k-anonymity floor
  // is not an access-control rule that an admin can be trusted past.
  const { fields, platforms, scope, thresholds } = await personaMetricsContext(db, config);
  const read = { thresholds, scopeDigest: scope.digest, source: 'live' } as const;

  // Validate the DOMAIN, not the shape: an unknown key is a clean 400 and never
  // reaches a SQL bind. One resolution for `field` and every key in `fields`.
  const requested = [
    ...(parsed.data.field === undefined ? [] : [parsed.data.field]),
    ...(parsed.data.fields === undefined
      ? []
      : parsed.data.fields.split(',').map((k) => k.trim()).filter((k) => k !== '')),
  ];
  const unique = [...new Set(requested)];
  if (unique.length > MAX_FIELDS_PER_REQUEST) {
    throw createError({
      statusCode: 400,
      statusMessage: `At most ${MAX_FIELDS_PER_REQUEST} fields per request`,
    });
  }

  const resolved: PersonaDistribution[] = [];
  for (const key of unique) {
    const field = fields.find((f) => f.fieldKey === key);
    if (field === undefined) {
      throw createError({ statusCode: 400, statusMessage: `Unknown persona field: ${key}` });
    }
    resolved.push(
      await getPersonaFieldDistribution(db, { ...read, field, limit: parsed.data.limit }),
    );
  }

  const distribution =
    parsed.data.field === undefined
      ? null
      : (resolved.find((d) => d.field === parsed.data.field) ?? null);

  const links = await getPersonaLinkPresence(db, { ...read, platforms });

  const audience = config.features.dataSharingConsents
    ? await getAudienceCounts(db, {
        ...read,
        offeredPurposes: scope.offerablePurposes.map((purpose) => ({
          purpose,
          scopeDigest: scope.digest,
        })),
      })
    : null;

  return {
    fields: fields.map((f) => ({
      sectionKey: f.sectionKey,
      fieldKey: f.fieldKey,
      label: f.label,
      multiValued: f.cardinality === 'set',
      options: f.options,
    })),
    distribution,
    distributions: resolved,
    links,
    audience,
    thresholds,
    quantum: thresholds.minBucket,
    asOf: null,
  };
});
