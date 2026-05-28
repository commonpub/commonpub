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

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);
  const db = useDB();

  const body = await parseBody(event, layoutCreateSchema);

  // Per-section configSchema validation (session 160 audit P1).
  // layoutCreateSchema only validates top-level shape; the per-type
  // Zod schemas (URL guards, size caps, sandbox flags, etc) live in
  // the section registry and must be enforced separately.
  validateSectionConfigs(body.zones);

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

  invalidateLayoutsByRouteCache();
  return saved;
});
