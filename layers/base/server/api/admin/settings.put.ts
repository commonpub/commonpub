import { setInstanceSetting } from '@commonpub/server';
import { adminSettingSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requirePermission(event, 'settings.manage');
  const db = useDB();
  const input = await parseBody(event, adminSettingSchema);

  await setInstanceSetting(db, input.key, input.value, admin.id);

  // Invalidate server-side theme cache when the default changes
  if (input.key === 'theme.default') {
    invalidateThemeCache();
  }

  // Rebuild the merged config so an admin rename (SEO brand) takes effect on the
  // next request without a redeploy — the site-identity-prime plugin re-reads it.
  if (input.key === 'instance.name' || input.key === 'instance.description') {
    invalidateConfigCache();
  }
});
