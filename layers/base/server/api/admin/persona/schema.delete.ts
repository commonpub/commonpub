/**
 * DELETE /api/admin/persona/schema
 *
 * Remove the admin override so `commonpub.config.ts` is authoritative again
 * (plan 5.3.2). This is the revert path `/admin/features` does not have:
 * `PUT /api/admin/features` merges and never removes, so a portal-touched flag
 * can never be won back by the git file and its Reset button silently does
 * nothing. Persona does not repeat that.
 *
 * It removes the OVERRIDE, never member data. Retired field keys, drift
 * acknowledgements and the type locks all survive on purpose: they are records
 * of what users stored and what an operator already decided, and reverting the
 * template is not a decision about either.
 *
 * The response reports what the instance serves AFTER the revert, so the editor
 * can re-render the file-sourced document without a second round trip. It is
 * idempotent: reverting when there is no override returns `removed: false` and
 * a 200, because the caller's intent ("the file should win") is already true.
 */
import {
  clearPersonaSchemaOverride,
  effectivePersonaSchema,
  parsePersonaConfig,
  type EffectivePersonaSchema,
} from '@commonpub/server';

export interface AdminPersonaSchemaDeleteResponse {
  removed: boolean;
  source: EffectivePersonaSchema['source'];
  effective: EffectivePersonaSchema['sections'];
  savedAt: string | null;
  drift: EffectivePersonaSchema['drift'];
  /** Non-null when the file the instance just fell back to is itself malformed. */
  fileError: string | null;
}

export default defineEventHandler(async (event): Promise<AdminPersonaSchemaDeleteResponse> => {
  requireFeature('admin');
  requireFeature('persona');
  const admin = requirePermission(event, 'settings.manage');

  const db = useDB();
  const config = useConfig();

  const { removed } = await clearPersonaSchemaOverride(db, {
    adminId: admin.id,
    ip: getRequestIP(event) ?? null,
  });

  const resolved = await effectivePersonaSchema(db, config);
  return {
    removed,
    source: resolved.source,
    effective: resolved.sections,
    savedAt: resolved.savedAt === null ? null : resolved.savedAt.toISOString(),
    drift: resolved.drift,
    fileError: parsePersonaConfig(config).error,
  };
});
