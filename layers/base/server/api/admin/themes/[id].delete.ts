/**
 * DELETE /api/admin/themes/[id]
 *
 * Delete a DB-stored custom theme. If the deleted theme is the current
 * instance default, the default falls back to `base` on the next read.
 */
import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import {
  deleteCustomTheme,
  customThemeDataAttr,
} from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ ok: true; resetDefault: boolean }> => {
  requireFeature('admin');
  const admin = requirePermission(event, 'theme.manage');
  const db = useDB();

  const { id } = parseParams(event, { id: 'string' });

  await deleteCustomTheme(db, id, admin.id);

  // If this theme was the active default, reset to `base` so SSR doesn't 404
  let resetDefault = false;
  const dataAttr = customThemeDataAttr(id);
  const [defaultRow] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, 'theme.default'));
  if (defaultRow?.value === dataAttr || defaultRow?.value === id) {
    await db
      .update(instanceSettings)
      .set({ value: 'base', updatedBy: admin.id, updatedAt: new Date() })
      .where(eq(instanceSettings.key, 'theme.default'));
    resetDefault = true;
  }

  invalidateThemeCache();
  return { ok: true, resetDefault };
});
