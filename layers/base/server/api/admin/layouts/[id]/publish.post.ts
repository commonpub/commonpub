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
  const admin = requirePermission(event, 'layout.manage');
  const db = useDB();

  const { id } = parseParams(event, { id: 'uuid' });

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  const version = await publishLayout(db, id, { publishedBy: admin.id });

  // Audit log (round 3): publish changes what the public sees — highest-
  // leverage action. layout_versions also stores publishedBy (durable trail);
  // stdout adds incident-response greppability.
  console.info('cpub.audit.layout.publish', JSON.stringify({
    at: new Date().toISOString(),
    adminId: admin.id,
    layoutId: id,
    scope: existing.scope,
    versionId: (version as { id?: string } | null | undefined)?.id ?? null,
  }));

  invalidateLayoutsByRouteCache();
  return version;
});
