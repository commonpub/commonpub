import { ConsoleEmailAdapter, SmtpEmailAdapter, ResendEmailAdapter } from '@commonpub/server';
import type { EmailAdapter } from '@commonpub/server';

let cachedAdapter: EmailAdapter | null = null;

/**
 * Create and cache an email adapter based on runtime config.
 * Reusable by auth middleware, notification plugin, and any server route.
 */
export function useEmailAdapter(): EmailAdapter {
  if (cachedAdapter) return cachedAdapter;

  const runtimeConfig = useRuntimeConfig();
  const adapter = (runtimeConfig.emailAdapter as string) || 'console';

  if (adapter === 'smtp') {
    const host = runtimeConfig.smtpHost as string;
    const port = parseInt(runtimeConfig.smtpPort as string, 10) || 587;
    const user = runtimeConfig.smtpUser as string;
    const pass = runtimeConfig.smtpPass as string;
    const from = runtimeConfig.smtpFrom as string;

    if (!host || !user || !pass || !from) {
      console.warn('[email] SMTP configured but missing credentials — falling back to console');
      cachedAdapter = new ConsoleEmailAdapter();
      return cachedAdapter;
    }

    cachedAdapter = new SmtpEmailAdapter({ host, port, user, pass, from });
    return cachedAdapter;
  }

  if (adapter === 'resend') {
    const apiKey = runtimeConfig.resendApiKey as string;
    const from = runtimeConfig.resendFrom as string;

    if (!apiKey || !from) {
      console.warn('[email] Resend configured but missing API key or from address — falling back to console');
      cachedAdapter = new ConsoleEmailAdapter();
      return cachedAdapter;
    }

    cachedAdapter = new ResendEmailAdapter({ apiKey, from });
    return cachedAdapter;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[email] ⚠ Using console email adapter in production — emails will be logged, not sent. Set NUXT_EMAIL_ADAPTER to "smtp" or "resend".');
  }
  cachedAdapter = new ConsoleEmailAdapter();
  return cachedAdapter;
}
