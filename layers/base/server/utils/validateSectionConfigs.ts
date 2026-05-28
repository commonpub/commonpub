/**
 * Per-section config validation — runs every section's registered
 * Zod schema against the user-submitted config blob.
 *
 * P1 security fix from session 160 audit. The `layoutCreateSchema`
 * top-level Zod only validates the SHAPE of `section.config` as
 * `z.record(z.unknown())` — it doesn't enforce the per-type rules
 * (URL guards on hrefs, size caps on arrays, sandbox flags on iframes,
 * etc) declared in each section's `configSchema`. Without this check,
 * an admin can bypass those guards by sending arbitrary config —
 * limited blast radius (admin auth required) but every CMS treats
 * admin-tier input as semi-trusted and validates anyway.
 *
 * Throws a 400 createError with a structured `data.sectionErrors`
 * payload listing every invalid section + the Zod issue. Used by:
 *   - POST /api/admin/layouts (create)
 *   - PUT  /api/admin/layouts/[id] (update)
 *
 * Unknown section types ALSO 400 — same handler — so a typo'd type
 * surfaces as a validation error instead of silently rendering a
 * placeholder on the public page.
 */
import type { SectionRegistry } from '@commonpub/ui';

/**
 * NOTE: this validator does NOT default-import the section registry.
 * The registry (`layers/base/sections/registry.ts`) imports every
 * builtin/*.ts which imports a Vue `.vue` component — and Nitro's
 * server bundle can't parse .vue. Passing the registry as a required
 * argument keeps this file server-safe.
 *
 * Proper fix (deferred): move per-section Zod schemas to
 * @commonpub/schema (server-safe), wire the validator there, then
 * callers can use a schema-only map instead of the runtime registry.
 * See docs/sessions/160-audit-round2-deep.md for the deferred queue.
 */

/**
 * Throw an h3/Nuxt-compatible HTTP error WITHOUT depending on h3
 * directly (h3 isn't a direct layer dep + isn't resolvable from
 * vitest). Nitro's error handler treats any thrown Error with
 * `statusCode` + `statusMessage` + `data` as the equivalent of
 * createError() — same wire format.
 */
function httpError(opts: { statusCode: number; statusMessage: string; data?: unknown }): Error {
  const err = new Error(opts.statusMessage) as Error & {
    statusCode: number;
    statusMessage: string;
    data?: unknown;
  };
  err.statusCode = opts.statusCode;
  err.statusMessage = opts.statusMessage;
  err.data = opts.data;
  return err;
}

interface InputZone {
  zone: string;
  rows: Array<{
    config?: unknown;
    sections: Array<{
      type: string;
      config: Record<string, unknown>;
    }>;
  }>;
}

interface SectionError {
  zone: string;
  rowIndex: number;
  sectionIndex: number;
  type: string;
  // Zod 4's issue.path is PropertyKey[] (string | number | symbol);
  // symbol paths in user-submitted JSON are not reachable but the type
  // must accept them.
  issues: Array<{ path: PropertyKey[]; message: string }>;
}

/**
 * Validate every section in a layout's zones against its registered
 * Zod configSchema. Throws an h3-compatible 400 on any failure.
 *
 * `registry` is REQUIRED — callers pass it explicitly to keep this
 * file from default-importing the registry's transitive .vue deps
 * (which break Nitro's server bundle). See file-level note above.
 */
export function validateSectionConfigs(
  zones: InputZone[],
  registry: SectionRegistry,
): void {
  const errors: SectionError[] = [];

  for (const zone of zones) {
    zone.rows.forEach((row, rowIndex) => {
      row.sections.forEach((section, sectionIndex) => {
        const def = registry.get(section.type);
        if (!def) {
          errors.push({
            zone: zone.zone,
            rowIndex,
            sectionIndex,
            type: section.type,
            issues: [{ path: ['type'], message: `Unknown section type: ${section.type}` }],
          });
          return;
        }
        const result = def.configSchema.safeParse(section.config);
        if (!result.success) {
          errors.push({
            zone: zone.zone,
            rowIndex,
            sectionIndex,
            type: section.type,
            issues: result.error.issues.map((i) => ({
              path: [...i.path],
              message: i.message,
            })),
          });
        }
      });
    });
  }

  if (errors.length > 0) {
    throw httpError({
      statusCode: 400,
      statusMessage: `Section config validation failed (${errors.length} section${errors.length === 1 ? '' : 's'})`,
      data: { code: 'SECTION_CONFIG_INVALID', sectionErrors: errors },
    });
  }
}
