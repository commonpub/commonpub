/**
 * POST /api/admin/layouts/[id]/publish
 *
 * Snapshot the current layout into `layout_versions`, set
 * `published_version_id`, transition `state` to 'published'. Returns
 * the version record.
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { getLayoutById, publishLayout } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../../utils/layoutCache';

export default defineEventHandler(async (event) => {
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

  const version = await publishLayout(db, id, { publishedBy: admin.id });
  invalidateLayoutsByRouteCache();
  return version;
});
