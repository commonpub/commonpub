/**
 * POST /api/admin/layouts
 *
 * Create a new layout for a scope. Body is the full layout payload
 * (validated against `layoutCreateSchema`) with client-generated UUIDs
 * for sections/rows. Returns the created LayoutRecord.
 *
 * Fails with 409 if a layout already exists at the given scope (the
 * editor should PUT to the existing one instead).
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { layoutCreateSchema } from '@commonpub/schema';
import { getLayoutByScope, saveLayout, validateCustomPageScope } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';
import { validateSectionConfigs } from '../../../utils/validateSectionConfigs';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requirePermission(event, 'layout.manage');
  const db = useDB();

  const body = await parseBody(event, layoutCreateSchema);

  // Per-section configSchema enforcement (R2 P1 deferred → wired session 161
  // once schemas moved to @commonpub/schema/sectionConfigs). On failure logs
  // an audit event + re-throws the validator's 400; otherwise no-ops.
  try {
    validateSectionConfigs(body.zones);
  } catch (err) {
    const e = err as { data?: { code?: string; sectionErrors?: unknown[] } };
    if (e?.data?.code === 'SECTION_CONFIG_INVALID') {
      console.info('cpub.audit.layout.config-rejected', JSON.stringify({
        at: new Date().toISOString(),
        adminId: admin.id,
        layoutId: null, // POST = create; no id yet
        scope: body.scope,
        errorCount: e.data.sectionErrors?.length ?? 0,
      }));
    }
    throw err;
  }

  // Custom-page paths get extra validation: pathNormalize + file-route
  // conflict + duplicate detection (Phase 2). Returns 400 for malformed
  // paths, 409 for collisions. The route-scope + virtual paths go
  // straight to the existing exists-check below — those types aren't
  // operator-creatable in v1 anyway.
  let scopeToSave = body.scope;
  if (body.scope.type === 'custom-page') {
    const validation = await validateCustomPageScope(db, body.scope.path);
    if (!validation.ok) {
      // 'has-query', 'has-fragment', 'has-dot-segment', 'invalid-char',
      // 'empty' → 400 (malformed)
      // 'reserved-prefix', 'file-route-conflict',
      // 'custom-page-already-exists' → 409 (collision)
      const status = (validation.reason === 'reserved-prefix'
        || validation.reason === 'file-route-conflict'
        || validation.reason === 'custom-page-already-exists') ? 409 : 400;
      throw createError({
        statusCode: status,
        statusMessage: validation.message,
        data: { reason: validation.reason },
      });
    }
    scopeToSave = validation.scope;
  }

  const existing = await getLayoutByScope(db, scopeToSave);
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `A layout already exists for scope ${JSON.stringify(scopeToSave)}; PUT to /api/admin/layouts/${existing.id} to update it`,
    });
  }

  const saved = await saveLayout(
    db,
    {
      scope: scopeToSave,
      name: body.name,
      pageMeta: body.pageMeta,
      zones: body.zones,
      state: body.state,
    },
    { userId: admin.id },
  );

  // Audit log (round 3): every new layout creation is forensically
  // significant — admins creating routes/custom-pages from scratch.
  console.info('cpub.audit.layout.create', JSON.stringify({
    at: new Date().toISOString(),
    adminId: admin.id,
    layoutId: saved.id,
    scope: saved.scope,
    name: saved.name,
    state: saved.state,
  }));

  invalidateLayoutsByRouteCache();
  return saved;
});
