// Nitro middleware for authentication using @commonpub/auth
import { createAuthMiddleware, type AuthLocals } from '@commonpub/auth';
import { createAuth } from '@commonpub/auth';
import { ConsoleEmailAdapter, emailTemplates } from '@commonpub/server';

let authMiddleware: ReturnType<typeof createAuthMiddleware> | null = null;

function getAuthMiddleware(): ReturnType<typeof createAuthMiddleware> {
  if (authMiddleware) return authMiddleware;

  const config = useConfig();
  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || 'CommonPub';

  // Email adapter — uses SMTP in production, console logger in dev
  const emailAdapter = new ConsoleEmailAdapter();

  const auth = createAuth({
    config,
    db: db as Parameters<typeof createAuth>[0]['db'],
    secret: (() => {
      const s = runtimeConfig.authSecret as string;
      if (!s && process.env.NODE_ENV === 'production') {
        throw new Error('AUTH_SECRET must be set in production');
      }
      return s || 'dev-secret-change-me';
    })(),
    baseURL: siteUrl,
    emailSender: {
      async sendResetPasswordEmail(email: string, url: string, _token: string): Promise<void> {
        const template = emailTemplates.passwordReset(siteName, url);
        await emailAdapter.send({ ...template, to: email });
      },
      async sendVerificationEmail(email: string, url: string, _token: string): Promise<void> {
        const template = emailTemplates.verification(siteName, url);
        await emailAdapter.send({ ...template, to: email });
      },
    },
  });

  authMiddleware = createAuthMiddleware({ auth });
  return authMiddleware;
}

declare module 'h3' {
  interface H3EventContext {
    auth: AuthLocals;
  }
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;

  // Skip auth for non-API routes and static assets
  if (!pathname.startsWith('/api') && !pathname.startsWith('/_nuxt')) {
    // Still resolve session for SSR pages
    try {
      const middleware = getAuthMiddleware();
      const headers = getRequestHeaders(event);
      const webHeaders = new Headers(headers as Record<string, string>);
      event.context.auth = await middleware.resolveSession(webHeaders);
    } catch {
      event.context.auth = { user: null, session: null };
    }
    return;
  }

  let middleware: ReturnType<typeof getAuthMiddleware>;
  try {
    middleware = getAuthMiddleware();
  } catch (err: unknown) {
    // DB not connected — fail with a clear message
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/')) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Database unavailable. Check that PostgreSQL is running.',
      });
    }
    event.context.auth = { user: null, session: null };
    return;
  }

  // Handle auth API routes
  if (pathname.startsWith('/api/auth')) {
    try {
      const response = await middleware.handleAuthRoute(
        toWebRequest(event),
        pathname,
      );
      if (response) {
        return sendWebResponse(event, response);
      }
    } catch (err: unknown) {
      throw createError({
        statusCode: 500,
        statusMessage: `Auth error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }

  // Resolve session for API requests
  try {
    const headers = getRequestHeaders(event);
    const webHeaders = new Headers(headers as Record<string, string>);
    event.context.auth = await middleware.resolveSession(webHeaders);
  } catch (err: unknown) {
    // DB error during session resolution — don't silently eat it for API routes
    if (pathname.startsWith('/api/')) {
      console.error('[auth] Session resolution failed:', err instanceof Error ? err.message : err);
    }
    event.context.auth = { user: null, session: null };
  }
});
