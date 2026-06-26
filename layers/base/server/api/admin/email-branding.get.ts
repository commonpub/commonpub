import { getEmailBranding } from '@commonpub/server';
import type { EmailBranding } from '@commonpub/server';

/** GET /api/admin/email-branding — current per-instance email branding (email Phase 2). */
export default defineEventHandler(async (event): Promise<EmailBranding> => {
  requireFeature('admin');
  requirePermission(event, 'email.manage');
  const db = useDB();
  return await getEmailBranding(db);
});
