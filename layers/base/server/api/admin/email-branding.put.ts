import { setInstanceSetting, EMAIL_BRANDING_KEY } from '@commonpub/server';
import { emailBrandingSchema } from '@commonpub/schema';

/** PUT /api/admin/email-branding — save email branding (email Phase 2). Validated
 *  (strict hex color, http(s) logo, length caps) so a stored value can't inject
 *  markup/CSS into rendered emails. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  requireFeature('admin');
  const admin = requirePermission(event, 'email.manage');
  const db = useDB();
  const input = await parseBody(event, emailBrandingSchema);
  await setInstanceSetting(db, EMAIL_BRANDING_KEY, input, admin.id, getRequestIP(event) ?? undefined);
  return { ok: true };
});
