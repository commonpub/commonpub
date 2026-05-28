/**
 * DELETE /api/admin/layouts/[id]
 *
 * Permanently delete a layout. Cascades through rows + sections + versions.
 *
 * NOT recoverable. The editor's UI surfaces a confirm modal; this API
 * trusts the caller.
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { deleteLayout, getLayoutById } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';

export default defineEventHandler(async (event): Promise<{ ok: true; id: string }> => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);
  const db = useDB();

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id param' });
  }

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  // Audit log (session 160 audit P2). Layout deletion is destructive +
  // not recoverable; structured stdout line gives operators a forensic
  // trail when an admin reports "the homepage layout disappeared".
  console.info('cpub.audit.layout.delete', JSON.stringify({
    at: new Date().toISOString(),
    adminId: admin.id,
    layoutId: id,
    scope: existing.scope,
    name: existing.name,
    state: existing.state,
  }));

  await deleteLayout(db, id);
  invalidateLayoutsByRouteCache();
  return { ok: true, id };
});
