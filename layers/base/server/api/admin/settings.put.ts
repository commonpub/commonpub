import { setInstanceSetting } from '@commonpub/server';
import { adminSettingSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requireAdmin(event);
  const db = useDB();
  const input = await parseBody(event, adminSettingSchema);

  await setInstanceSetting(db, input.key, input.value, admin.id);

  // Invalidate server-side theme cache when the default changes
  if (input.key === 'theme.default') {
    invalidateThemeCache();
  }
});
