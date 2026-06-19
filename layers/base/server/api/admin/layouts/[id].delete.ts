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
  const admin = requirePermission(event, 'layout.manage');
  const db = useDB();

  const { id } = parseParams(event, { id: 'uuid' });

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  // R4 audit P1 fix: homepage scope special-case. Deleting the
  // ('route', '/') layout nukes the homepage + its entire publish
  // history. The list-page UI already confirm()s before DELETE, but
  // the API can also be called directly — require an explicit
  // X-Cpub-Confirm-Homepage-Delete: 1 header for the homepage scope
  // as defense-in-depth. Surfaces operator footgun loudly + audit log
  // still captures the action when the header is set.
  const isHomepage =
    existing.scope.type === 'route' && existing.scope.path === '/';
  if (isHomepage && getHeader(event, 'x-cpub-confirm-homepage-delete') !== '1') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Refusing to delete the homepage layout without explicit confirmation',
      data: {
        code: 'HOMEPAGE_DELETE_NEEDS_CONFIRM',
        hint: 'Set X-Cpub-Confirm-Homepage-Delete: 1 header to override.',
      },
    });
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
