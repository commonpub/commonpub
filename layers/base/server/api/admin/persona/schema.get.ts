/**
 * GET /api/admin/persona/schema
 *
 * The persona schema editor's read side (plan 5.4). It returns all THREE
 * sources separately, not just the winner, because 5.3.2's whole point is that
 * an operator can see what diverges before pressing Revert:
 *
 * - `file`     what `commonpub.config.ts` declares (null when it declares nothing);
 * - `db`       the admin override as it survives the sink-side sanitizer (null when absent);
 * - `effective` what the instance actually serves, after DB-beats-file-beats-builtin.
 *
 * `savedAt` is the `If-Match` token for the PUT. It is null when no DB override
 * exists, and a PUT that sends a token in that state is a genuine conflict: the
 * override the client was editing has since been reverted.
 *
 * `fileError` is surfaced rather than swallowed. `parsePersonaConfig` returns the
 * message instead of throwing precisely so a malformed config file shows up as an
 * operator-visible error rather than as the persona surface quietly serving
 * built-ins (plan 5.3.1: the config path bypasses every admin-route guard).
 */
import {
  PERSONA_SECTIONS_SETTING_KEY,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  getInstanceSetting,
  getPersonaRetiredFields,
  parsePersonaConfig,
  sanitizePersonaSchema,
  type EffectivePersonaSchema,
  type PersonaRetiredField,
  type PersonaSchemaDrift,
} from '@commonpub/server';

type PersonaSections = EffectivePersonaSchema['sections'];

export interface AdminPersonaSchemaResponse {
  file: PersonaSections | null;
  fileError: string | null;
  db: PersonaSections | null;
  effective: PersonaSections;
  source: EffectivePersonaSchema['source'];
  /** ISO timestamp, or null. THE `If-Match` token for `PUT`. */
  savedAt: string | null;
  drift: PersonaSchemaDrift[];
  /** Built-ins union file union DB, so the editor can offer a `link` platform picker. */
  platforms: Array<{ key: string; label: string }>;
  retired: PersonaRetiredField[];
}

export default defineEventHandler(async (event): Promise<AdminPersonaSchemaResponse> => {
  requireFeature('admin');
  requireFeature('persona');
  requirePermission(event, 'settings.manage');

  const db = useDB();
  const config = useConfig();

  const parsedFile = parsePersonaConfig(config);
  const [effective, storedRaw, platforms, retired] = await Promise.all([
    effectivePersonaSchema(db, config),
    getInstanceSetting(db, PERSONA_SECTIONS_SETTING_KEY),
    effectivePersonaLinkPlatforms(db, config),
    getPersonaRetiredFields(db),
  ]);

  return {
    file: parsedFile.config?.sections ?? null,
    fileError: parsedFile.error,
    // Read through the SAME sanitizer the resolver uses, so the editor renders
    // what the instance would actually serve rather than the raw jsonb a write
    // through the generic settings route could have left behind.
    db: storedRaw === null ? null : sanitizePersonaSchema(storedRaw),
    effective: effective.sections,
    source: effective.source,
    savedAt: effective.savedAt === null ? null : effective.savedAt.toISOString(),
    drift: effective.drift,
    platforms: platforms.map((p) => ({ key: p.key, label: p.label })),
    retired,
  };
});
