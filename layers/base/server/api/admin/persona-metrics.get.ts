/**
 * GET /api/admin/persona-metrics
 *
 * The operator-facing audience dashboard (plan 7.4, last row).
 *
 * THIS ROUTE APPLIES NO K-ANONYMITY FLOOR, AND THAT IS THE CORRECTION (plan
 * R3.4 phase 4). It used to apply the public API's floors, quantisation and
 * whole-field suppression on the argument that "the consent is with the member,
 * not with the API". That argument was written for a model in which being
 * counted was a consent question, and it does not survive the model changing.
 *
 * Two facts decide it now. The operator is the DATA CONTROLLER: their own
 * members' answers are theirs to read, they hold the rows, and every single
 * answer is already reachable one profile at a time through the admin user
 * screens. Suppression here was never access control; it prevented bulk
 * convenience for the one party that already has access, while a determined
 * operator read the same numbers by hand. And the numbers are now produced under
 * legitimate interest with an objection switch rather than under a promise of
 * anonymity to each member, so there is no sentence for an exact count to
 * contradict.
 *
 * WHAT DID NOT CHANGE. Objectors are excluded, because an objection is an
 * objection to being counted at all and not a request for coarser rounding;
 * `countedUserWhere` in `metrics.ts` carries that anti-join and this route gets
 * no exemption from it. Nothing here widens the PUBLIC surface: the four
 * `/api/public/v1/metrics/persona/*` routes still resolve their thresholds from
 * the operator's config through `personaMetricsContext`, still serve a finalised
 * day, and are the only surface `resolvePersonaThresholds` clamps for.
 *
 * The temporal difference is unchanged. Public endpoints serve a finalised UTC
 * day, because polling a live count lets a caller watch the exact moment a
 * bucket crosses the floor from below, which identifies that one person. An
 * operator holding a session is not that caller, and an operator tuning a schema
 * needs to see the effect of a change before tomorrow, so this route reads
 * `source: 'live'` and reports `asOf: null` — a moment, not a day.
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

/**
 * The floors this route applies: none that can hide anything.
 *
 * `minBucket: 1` means the database's `HAVING count(*) >= 1` keeps every bucket
 * that exists, `quantisePersonaCount(n, 1)` is the identity, and the whole-field
 * suppression that refuses a scalar field with any withheld bucket can never
 * trigger, because nothing is withheld. `minPopulation: 1` leaves exactly one
 * refusal in place: an instance with nobody counted at all says so rather than
 * publishing an empty list that reads as "nobody answered".
 *
 * BUILT HERE RATHER THAN THROUGH `resolvePersonaThresholds`, deliberately and
 * visibly. That function CLAMPS UP to the hard floors in `@commonpub/persona`
 * and must keep doing so: it is what stops an operator dialling the PUBLISHED
 * floors below the constants. This literal is the one place in the tree that
 * declines the floors, it is reachable only behind `requirePermission('audit.read')`
 * on the operator's own instance, and it must not be copied into any route that
 * publishes. If you are reading this while writing a new public endpoint, you
 * want `personaMetricsContext(...).thresholds`, which is returned below as
 * `publicThresholds` precisely so this page can state what the public API does.
 */
const OPERATOR_UNSUPPRESSED_THRESHOLDS: PersonaMetricsThresholds = {
  minBucket: 1,
  minPopulation: 1,
};

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
  /** Present only when `?field=` names a countable field. Exact counts. */
  distribution: PersonaDistribution | null;
  /** One entry per key in `?fields=`, in the order requested. Empty when absent. */
  distributions: PersonaDistribution[];
  links: PersonaLinkPresence;
  audience: PersonaAudienceCounts | null;
  /**
   * The floors the PUBLIC API applies, which this route does NOT.
   *
   * Carried so the page can say what a caller of `/api/public/v1/metrics/persona/*`
   * would see instead, in the operator's own configured numbers. Renamed from
   * `thresholds` on purpose: a key called `thresholds` on a payload that applies
   * none would be read as the floors in force here, which is the single most
   * dangerous misreading this response can invite.
   */
  publicThresholds: PersonaMetricsThresholds;
  /** Always 1 here, because these counts are exact rather than floored. */
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

  // The same FIELD and PLATFORM resolution the public routes use. That part has
  // not changed and must not: an admin screen counting a field the aggregatable
  // list excludes (sensitive, retired, drifted) would count answers the rollup
  // never writes and no surface can serve, so the two would disagree about what
  // the instance even asks. What this route declines is the k-anonymity FLOOR,
  // not the field set.
  const { fields, platforms, scope, thresholds } = await personaMetricsContext(db, config);
  const read = { thresholds: OPERATOR_UNSUPPRESSED_THRESHOLDS, source: 'live' } as const;

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

  // The audience counts keep their digest-bound consent join, because that one
  // really is a count of grant holders: "how many members are open to
  // recruiters" is a question about consent and stays one. Only the FLOOR is
  // declined, which is why the digest still travels here and nowhere else.
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
    // The operator's configured floors, for the page to state as what the
    // PUBLIC API does. Nothing in this response was computed with them.
    publicThresholds: thresholds,
    quantum: OPERATOR_UNSUPPRESSED_THRESHOLDS.minBucket,
    asOf: null,
  };
});
