/**
 * POST /api/admin/layouts/[id]/versions/[versionId]/revert
 *
 * Restore a layout to a prior version snapshot. The original version
 * row is NOT touched — snapshots are immutable. The layout's current
 * rows + sections are rewritten from the snapshot, and the state
 * transitions to 'draft' (admin can re-publish if desired).
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { getLayoutById, revertToVersion } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../../../../utils/layoutCache';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);
  const db = useDB();

  const id = getRouterParam(event, 'id');
  const versionId = getRouterParam(event, 'versionId');
  if (!id || !versionId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id or versionId param' });
  }

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  try {
    const reverted = await revertToVersion(db, id, versionId, { userId: admin.id });

    // Audit log (round 3): revert overwrites current state with a prior
    // snapshot — destructive transformation, deserves forensic trail.
    console.info('cpub.audit.layout.revert', JSON.stringify({
      at: new Date().toISOString(),
      adminId: admin.id,
      layoutId: id,
      scope: existing.scope,
      versionId,
    }));

    invalidateLayoutsByRouteCache();
    return reverted;
  } catch (e) {
    // revertToVersion throws on missing version — map to 404
    if (e instanceof Error && e.message.includes('Version not found')) {
      throw createError({ statusCode: 404, statusMessage: e.message });
    }
    throw e;
  }
});
