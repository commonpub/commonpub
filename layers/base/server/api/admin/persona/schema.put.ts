/**
 * PUT /api/admin/persona/schema
 *
 * Save the whole-document admin override of the persona sections (plan 5.4).
 * Never the generic settings route: `PUT /api/admin/settings` takes
 * `{ key, value: z.unknown() }` and would let a well-formed-looking template
 * bypass every guard below.
 *
 * Four layers, in this order, because each one assumes the previous passed:
 *
 * 1. `personaSectionsSchema` — shape, caps, unique section keys, field keys
 *    unique across ALL sections (they are the analytics namespace), unique
 *    option values. Failures come back as PER-FIELD structured errors shaped
 *    like `server/utils/validateSectionConfigs.ts`, not a flat message, because
 *    the editor has to point at the offending field.
 * 2. `If-Match` on `savedAt` — 409 `PERSONA_SCHEMA_CONFLICT` carrying BOTH
 *    timestamps, copied from `admin/layouts/[id].put.ts`. Omit the header to
 *    force an unconditional write.
 * 3. Platform existence — a `link` field naming a platform this instance does
 *    not declare writes nowhere. Not force-able: it is a mistake, not a
 *    destructive-but-intended act. 400.
 * 4. The destructive checks (plan 5.4, 5.5). A field key with stored rows
 *    cannot change `type`, `column`, `sensitive` or its storage sink, and
 *    cannot drop an option, without `?force=true`. A field the save DROPS
 *    needs an explicit `removal` decision, purge or retain, per plan 4.6. Both
 *    come back as 409 `PERSONA_SCHEMA_DESTRUCTIVE` with the row counts, so the
 *    confirmation the operator sees can name the number (5.5).
 *
 * Nothing here ever deletes data implicitly. A save that drops a field applies
 * the operator's own removal decision AFTER the schema is persisted, so a failed
 * save can never leave purged rows behind for a field that is still in the
 * template.
 */
import {
  bandPersonaCount,
  countPersonaFieldOptionRows,
  countPersonaFieldRows,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  flattenPersonaFields,
  personaSchemaChangeCandidates,
  personaSectionsSchema,
  planPersonaSchemaChange,
  purgePersonaField,
  retirePersonaField,
  savePersonaSchemaOverride,
  type EffectivePersonaSchema,
  type PersonaSchemaBlocker,
} from '@commonpub/server';

// Relative, not auto-imported: Nitro routes do not auto-import from `utils/`.
import { personaMetricsContext } from '../../../utils/personaMetricsContext';
import { z } from 'zod';

/**
 * Every persona symbol this ROUTE uses comes from `@commonpub/server`, which
 * re-exports what `@commonpub/persona` owns.
 *
 * That is a rule about this directory, not about the layer. `layers/base` DOES
 * declare `@commonpub/persona` (`package.json`, pinned by
 * `server/api/consent/__tests__/purposes-contract.test.ts`) because Vue
 * components cannot reach a Node-only package and several of them import
 * `personaCompleteness`, `personaFieldSpec` and the types directly. What
 * `__tests__/persona-server-exports.test.ts` protects is narrower: the persona
 * ADMIN routes take a single dependency edge, so a fork wiring them up needs
 * one package, and a missing re-export fails the build rather than surfacing as
 * a runtime `undefined`.
 *
 * The field TYPE is derived from `EffectivePersonaSchema` for the same reason:
 * it needs no export of its own.
 */
type PersonaSections = EffectivePersonaSchema['sections'];

const REMOVAL_ACTIONS = ['purge', 'retain'] as const;
type RemovalAction = (typeof REMOVAL_ACTIONS)[number];

/**
 * The envelope only. `sections` is deliberately `z.array(z.unknown())` here so
 * the real parse can run separately and produce per-field issues; `parseBody`'s
 * flattened `fieldErrors` would collapse every section into one `sections` key.
 * The byte ceiling is `parseBody`'s 10 MB and the element ceiling is
 * `personaSectionsSchema`'s own caps, so nothing is unbounded in between.
 */
const bodySchema = z.object({
  sections: z.array(z.unknown()),
  removal: z.record(z.string(), z.enum(REMOVAL_ACTIONS)).default({}),
});

const querySchema = z.object({
  force: z.enum(['true', 'false']).optional(),
});

export interface PersonaSchemaFieldError {
  sectionIndex: number | null;
  sectionKey: string | null;
  fieldIndex: number | null;
  fieldKey: string | null;
  path: Array<string | number>;
  message: string;
}

/**
 * Re-exported so the admin page can import the blocker shape from the route it
 * talks to rather than hand-mirroring it. The definition lives in
 * `@commonpub/server` with the analysis that produces it.
 */
export type { PersonaSchemaBlocker };

export interface AdminPersonaSchemaPutResponse {
  savedAt: string;
  source: EffectivePersonaSchema['source'];
  effective: PersonaSections;
  drift: EffectivePersonaSchema['drift'];
  /** What the removal map actually did, so the UI can report it rather than guess. */
  removals: Array<{ fieldKey: string; action: RemovalAction; rows: number }>;
  forced: boolean;
}

/** Narrow a Zod issue path to the JSON-addressable segments. */
function jsonPath(path: readonly PropertyKey[]): Array<string | number> {
  const out: Array<string | number> = [];
  for (const segment of path) {
    if (typeof segment === 'symbol') continue;
    out.push(segment);
  }
  return out;
}

function readKey(value: unknown): string | null {
  if (value === null || typeof value !== 'object') return null;
  const key = (value as Record<string, unknown>).key;
  return typeof key === 'string' ? key : null;
}

/**
 * Map Zod issues onto (section, field) coordinates.
 *
 * The paths look like `[0, 'fields', 2, 'options', 1, 'value']`, so the first two
 * numeric hops identify the section and the field. The KEYS are read back out of
 * the raw submitted document rather than the parsed one, which does not exist
 * yet: an editor needs to highlight the field the operator is looking at, and
 * index-only coordinates break the moment a section is reordered.
 */
function toFieldErrors(raw: unknown[], error: z.ZodError): PersonaSchemaFieldError[] {
  return error.issues.map((issue) => {
    const path = jsonPath(issue.path);
    const sectionIndex = typeof path[0] === 'number' ? path[0] : null;
    const section = sectionIndex === null ? undefined : raw[sectionIndex];
    const fields =
      section !== null && typeof section === 'object'
        ? (section as Record<string, unknown>).fields
        : undefined;
    const fieldIndex = path[1] === 'fields' && typeof path[2] === 'number' ? path[2] : null;
    const field = fieldIndex !== null && Array.isArray(fields) ? fields[fieldIndex] : undefined;
    return {
      sectionIndex,
      sectionKey: readKey(section),
      fieldIndex,
      fieldKey: readKey(field),
      path,
      message: issue.message,
    };
  });
}

export default defineEventHandler(async (event): Promise<AdminPersonaSchemaPutResponse> => {
  requireFeature('admin');
  requireFeature('persona');
  const admin = requirePermission(event, 'settings.manage');

  const db = useDB();
  const config = useConfig();

  const parsedQuery = querySchema.safeParse(getQuery(event));
  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsedQuery.error.flatten(),
    });
  }
  const force = parsedQuery.data.force === 'true';

  const body = await parseBody(event, bodySchema);

  // --- 1. shape --------------------------------------------------------------
  const parsed = personaSectionsSchema.safeParse(body.sections);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid persona schema',
      data: {
        code: 'PERSONA_SCHEMA_INVALID',
        fieldErrors: toFieldErrors(body.sections, parsed.error),
      },
    });
  }
  const next: PersonaSections = parsed.data;

  // --- 2. optimistic concurrency --------------------------------------------
  const current = await effectivePersonaSchema(db, config);
  const serverSavedAt = current.savedAt === null ? null : current.savedAt.toISOString();
  const ifMatch = getHeader(event, 'if-match');
  if (ifMatch !== undefined && ifMatch.trim() !== '' && ifMatch.trim() !== serverSavedAt) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Persona schema was modified by another session',
      data: {
        code: 'PERSONA_SCHEMA_CONFLICT',
        clientSavedAt: ifMatch.trim(),
        serverSavedAt,
      },
    });
  }

  // --- 3. platform existence -------------------------------------------------
  const platforms = await effectivePersonaLinkPlatforms(db, config);
  const platformKeys = new Set(platforms.map((p) => p.key));
  const unknownPlatforms: PersonaSchemaFieldError[] = [];
  next.forEach((section, sectionIndex) => {
    section.fields.forEach((field, fieldIndex) => {
      if (field.type !== 'link') return;
      if (field.platform !== undefined && platformKeys.has(field.platform)) return;
      unknownPlatforms.push({
        sectionIndex,
        sectionKey: section.key,
        fieldIndex,
        fieldKey: field.key,
        path: [sectionIndex, 'fields', fieldIndex, 'platform'],
        message:
          field.platform === undefined
            ? 'A link field must name a platform'
            : `Unknown link platform: ${field.platform}`,
      });
    });
  });
  if (unknownPlatforms.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid persona schema',
      data: { code: 'PERSONA_SCHEMA_INVALID', fieldErrors: unknownPlatforms },
    });
  }

  // --- 4. destructive checks -------------------------------------------------
  // The analysis itself is `planPersonaSchemaChange` in `@commonpub/server`: it
  // is a pure comparison of two templates plus two count maps, so it is unit
  // tested against a real database there rather than through a Nitro stub here.
  const before = flattenPersonaFields(current.sections);
  const after = flattenPersonaFields(next);

  const rowCounts = new Map<string, number>();
  // Per-option counts, for the option-removal branch only. Without them the
  // route has to treat "this field has answers" as "this option has answers"
  // and demand `?force=true` for a value nobody ever picked, which teaches an
  // operator that force is routine. Neither map ever leaves this process raw.
  const optionCounts = new Map<string, Record<string, number>>();
  await Promise.all(
    personaSchemaChangeCandidates(before, after).map(async (key) => {
      const [rows, byOption] = await Promise.all([
        countPersonaFieldRows(db, key),
        countPersonaFieldOptionRows(db, key),
      ]);
      rowCounts.set(key, rows);
      optionCounts.set(key, byOption);
    }),
  );

  // The operator's own k-anonymity floor, so the bands this route reports match
  // the ones every published count uses.
  const { thresholds } = await personaMetricsContext(db, config);
  const { blockers, removalNeeded } = planPersonaSchemaChange({
    before,
    after,
    rowCounts,
    optionCounts,
    removal: body.removal,
    minBucket: thresholds.minBucket,
  });

  // A removal decision is never waived by `force`: purge and retain mean
  // different things to a member's data and the operator has to pick one.
  const unresolved = blockers.filter((b) => b.requires === 'removal');
  const forceable = blockers.filter((b) => b.requires === 'force');
  if (unresolved.length > 0 || (forceable.length > 0 && !force)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This save would discard stored answers',
      data: {
        code: 'PERSONA_SCHEMA_DESTRUCTIVE',
        blockers: [...unresolved, ...forceable],
      },
    });
  }

  // Forensic trail, greppable, mirroring `cpub.audit.layout.force-save`. It names
  // the row count, which is exactly what plan 5.4 asks the audit line to carry.
  if (force && forceable.length > 0) {
    console.info(
      'cpub.audit.persona.schema.force-save',
      JSON.stringify({
        at: new Date().toISOString(),
        adminId: admin.id,
        blockers: forceable.map((b) => ({
          fieldKey: b.fieldKey,
          kind: b.kind,
          affectedRows: b.affectedRows,
        })),
      }),
    );
  }

  // --- save, then apply the removal decisions --------------------------------
  const ip = getRequestIP(event) ?? null;
  const saved = await savePersonaSchemaOverride(db, { sections: next, adminId: admin.id, ip });
  if (!saved.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid persona schema',
      data: { code: 'PERSONA_SCHEMA_INVALID', fieldErrors: [], message: saved.error },
    });
  }

  const removals: AdminPersonaSchemaPutResponse['removals'] = [];
  for (const key of new Set(removalNeeded)) {
    const action = body.removal[key];
    if (action === undefined) continue;
    // `removalNeeded` holds only keys genuinely ABSENT from the saved document,
    // so `retirePersonaField` here always means what it says. A `sink_changed`
    // key is still in the schema and is never retired: writing it into
    // `persona.retiredFields` is permanent, and toggling `analytics` off and on
    // again would have blocked the field from every aggregate forever.
    if (action === 'purge') {
      const { deleted } = await purgePersonaField(db, { fieldKey: key, adminId: admin.id, ip });
      removals.push({ fieldKey: key, action, rows: bandPersonaCount(deleted, thresholds.minBucket).value });
    } else {
      const { retained } = await retirePersonaField(db, { fieldKey: key, adminId: admin.id, ip });
      removals.push({ fieldKey: key, action, rows: bandPersonaCount(retained, thresholds.minBucket).value });
    }
  }

  const resolved = await effectivePersonaSchema(db, config);
  return {
    savedAt: saved.savedAt.toISOString(),
    source: resolved.source,
    effective: resolved.sections,
    drift: resolved.drift,
    removals,
    forced: force && forceable.length > 0,
  };
});
