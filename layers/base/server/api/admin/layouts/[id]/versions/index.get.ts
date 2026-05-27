/**
 * GET /api/admin/layouts/[id]/versions
 *
 * List all immutable version snapshots for a layout, newest first.
 * Each entry has the FULL snapshot embedded — useful for the version
 * history UI to show a preview of "what this version looked like".
 *
 * Admin + features.admin + features.layoutEngine.
 */
import { getLayoutById, listLayoutVersions } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  requireAdmin(event);
  const db = useDB();

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id param' });
  }

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  return listLayoutVersions(db, id);
});
