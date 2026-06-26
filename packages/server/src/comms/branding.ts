import { emailBrandingSchema } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { EmailBranding } from '../email.js';
import { getInstanceSetting } from '../admin/admin.js';

const EMAIL_BRANDING_KEY = 'email.branding';

/**
 * Read the per-instance email branding (email Phase 2) from instance settings.
 * Re-validates with the same schema used on write (defense in depth) and returns
 * an empty object when unset/invalid, so callers always get a safe shape to pass
 * to the email templates (each field falls back to its built-in default).
 */
export async function getEmailBranding(db: DB): Promise<EmailBranding> {
  const raw = await getInstanceSetting(db, EMAIL_BRANDING_KEY);
  if (!raw) return {};
  const parsed = emailBrandingSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export { EMAIL_BRANDING_KEY };
