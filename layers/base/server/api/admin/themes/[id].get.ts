/**
 * GET /api/admin/themes/[id]
 *
 * Returns a single custom theme by ID. 404 if not found.
 */
import { getCustomTheme } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requirePermission(event, 'theme.manage');
  const db = useDB();

  const { id } = parseParams(event, { id: 'string' });

  const theme = await getCustomTheme(db, id);
  if (!theme) {
    throw createError({ statusCode: 404, statusMessage: 'Theme not found' });
  }
  return theme;
});
