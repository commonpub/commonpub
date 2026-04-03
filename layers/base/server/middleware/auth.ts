// Nitro middleware for authentication using @commonpub/auth
import { createAuthMiddleware, type AuthLocals } from '@commonpub/auth';
import { createAuth } from '@commonpub/auth';
import { emailTemplates } from '@commonpub/server';

let authMiddleware: ReturnType<typeof createAuthMiddleware> | null = null;

function getAuthMiddleware(): ReturnType<typeof createAuthMiddleware> {
  if (authMiddleware) return authMiddleware;

  const config = useConfig();
  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || 'CommonPub';

  const emailAdapter = useEmailAdapter();

  // In dev, trust any localhost origin so port changes don't break auth
  const trustedOrigins = process.env.NODE_ENV !== 'production'
    ? [siteUrl, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005']
    : [siteUrl];

  const auth = createAuth({
    config,
    db: db as unknown as Parameters<typeof createAuth>[0]['db'],
    secret: (() => {
      const s = runtimeConfig.authSecret as string;
      if (!s && process.env.NODE_ENV === 'production') {
        throw new Error('AUTH_SECRET must be set in production');
      }
      return s || 'dev-secret-change-me';
    })(),
    baseURL: siteUrl,
    trustedOrigins,
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

/**
 * Enrich the session user with custom DB columns (role, username, status)
 * that Better Auth doesn't include by default.
 */
async function enrichUser(auth: AuthLocals): Promise<void> {
  if (!auth.user?.id) return;
  try {
    const db = useDB();
    const { users } = await import('@commonpub/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select({ role: users.role, username: users.username, status: users.status })
      .from(users).where(eq(users.id, auth.user.id)).limit(1);
    if (row) {
      (auth.user as unknown as Record<string, unknown>).role = row.role;
      (auth.user as unknown as Record<string, unknown>).username = row.username;
      (auth.user as unknown as Record<string, unknown>).status = row.status;
    }
  } catch {
    // Non-fatal — user just won't have role/username
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
      await enrichUser(event.context.auth);
    } catch {
      event.context.auth = { user: null, session: null };
    }
    return;
  }

  let middleware: ReturnType<typeof getAuthMiddleware>;
  try {
    middleware = getAuthMiddleware();
  } catch {
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

  // Handle auth API routes — skip our custom federated/oauth2 routes (Nitro handles those)
  const isBetterAuthRoute = pathname.startsWith('/api/auth')
    && !pathname.startsWith('/api/auth/federated/')
    && !pathname.startsWith('/api/auth/oauth2/');

  if (isBetterAuthRoute) {
    try {
      const response = await middleware.handleAuthRoute(
        toWebRequest(event),
        pathname,
      );
      if (response) {
        return sendWebResponse(event, response);
      }
    } catch (err: unknown) {
      console.error('[auth] Route handler error:', err instanceof Error ? err.message : err);
      throw createError({
        statusCode: 500,
        statusMessage: 'Authentication service error',
      });
    }
  }

  // Resolve session for API requests
  try {
    const headers = getRequestHeaders(event);
    const webHeaders = new Headers(headers as Record<string, string>);
    event.context.auth = await middleware.resolveSession(webHeaders);
    await enrichUser(event.context.auth);
  } catch (err: unknown) {
    // DB error during session resolution — don't silently eat it for API routes
    if (pathname.startsWith('/api/')) {
      console.error('[auth] Session resolution failed:', err instanceof Error ? err.message : err);
    }
    event.context.auth = { user: null, session: null };
  }
});
