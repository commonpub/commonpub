/**
 * GET /api/admin/layouts/[id]
 *
 * Fetch a layout by id. Returns the full record including draft state +
 * version pointer. 404 if not found.
 *
 * Admin + features.admin + features.layoutEngine.
 */
import { getLayoutById } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  requirePermission(event, 'layout.manage');

  const { id } = parseParams(event, { id: 'uuid' });

  const db = useDB();
  const layout = await getLayoutById(db, id);
  if (!layout) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }
  return layout;
});
