// Nitro middleware for authentication using @commonpub/auth
import { createAuthMiddleware, type AuthLocals } from '@commonpub/auth';
import { createAuth } from '@commonpub/auth';
import { emailTemplates, emitHook, recordConsent, getEmailBranding, getEffectiveTermsVersion } from '@commonpub/server';

let authMiddleware: ReturnType<typeof createAuthMiddleware> | null = null;
let authInstance: ReturnType<typeof createAuth> | null = null;

/**
 * The configured Better Auth instance, for the few server routes that need to
 * call its server-side API directly (`auth.api.*`) rather than proxy an HTTP
 * request through it.
 *
 * Exists because a verification token is a Better Auth HS256 JWT carrying
 * `{ email, updateTo }`; hand-rolling one in a route would duplicate the token
 * format and drift from it. Self-initializing, so a route may call this without
 * depending on the middleware having run first (in practice it always has, since
 * Nitro runs server/middleware before route handlers).
 */
export function getAuthInstance(): ReturnType<typeof createAuth> {
  if (!authInstance) getAuthMiddleware();
  return authInstance!;
}

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
        const template = emailTemplates.passwordReset(siteName, url, await getEmailBranding(db));
        await emailAdapter.send({ ...template, to: email });
      },
      async sendVerificationEmail(email: string, _url: string, token: string): Promise<void> {
        // Point the email at the app's OWN branded verify page — NOT Better Auth's
        // raw `url` (the GET API route `/api/auth/verify-email`, which on click
        // 302-redirects to the homepage and shows no confirmation UI). The page
        // then calls the GET endpoint with this token. `_url` is intentionally
        // ignored for that reason.
        const verifyUrl = `${siteUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
        const template = emailTemplates.verification(siteName, verifyUrl, await getEmailBranding(db));
        await emailAdapter.send({ ...template, to: email });
      },
    },
    onUserCreated: async (user) => {
      // GDPR (session 227): record the terms/CoC acceptance the signup form
      // gates on. Best-effort + isolated so a consent-write failure can't break
      // registration (and vice-versa with the hook bus below).
      try {
        await recordConsent(db, {
          userId: user.id,
          kind: 'terms',
          version: await getEffectiveTermsVersion(db, config.instance.termsVersion ?? '1'),
        });
      } catch { /* swallow — registration already succeeded */ }
      await emitHook('user:registered', {
        db,
        userId: user.id,
        username: user.username ?? '',
        email: user.email,
      });
    },
  });

  authInstance = auth;
  authMiddleware = createAuthMiddleware({ auth });
  return authMiddleware;
}

declare module 'h3' {
  interface H3EventContext {
    auth: AuthLocals;
  }
}

/**
 * Attach the user's resolved permissions to the request context (RBAC Phase 0).
 * One cached Map hit on the hot path (30s TTL), like feature-flags-prime. Reads
 * the userId from the already-enriched auth user. Fail-closed: on any error the
 * context stays unset and the guards default-deny — but the admin floor still
 * holds because `requirePermission` falls back to the enriched `user.role`
 * (INV-2). No-op for anon requests. `resolvePermissions` is a Nitro auto-import.
 */
async function attachPermissions(event: import('h3').H3Event, auth: AuthLocals): Promise<void> {
  if (!auth?.user?.id) return;
  try {
    // Pass the enriched role so the resolver skips its own users query (admin +
    // flag-off paths do zero extra DB work) and stays consistent with enrichUser.
    const primaryRole = (auth.user as unknown as { role?: string }).role;
    event.context.cpubPermissions = await resolvePermissions(auth.user.id, primaryRole);
  } catch {
    // Leave unset — guards default-deny; admin floor survives via user.role.
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
      // Ban/suspend enforcement: a non-active user must not carry an authenticated
      // context, even with a still-valid session cookie. This is the single choke
      // point every SSR + API request flows through, so nulling here revokes access
      // immediately on the next request after a suspend/delete.
      if (row.status !== 'active') {
        auth.user = null;
        auth.session = null;
        return;
      }
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
      await attachPermissions(event, event.context.auth);
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

  // Handle auth API routes — skip custom routes that Nitro handles directly
  const isCustomAuthRoute = pathname.startsWith('/api/auth/federated/')
    || pathname.startsWith('/api/auth/oauth2/')
    || pathname.startsWith('/api/auth/mastodon/')
    || pathname === '/api/auth/sign-in-username'
    || pathname === '/api/auth/delete-user'
    || pathname === '/api/auth/export-data';
  const isBetterAuthRoute = pathname.startsWith('/api/auth') && !isCustomAuthRoute;

  // Better Auth's stock POST /api/auth/send-verification-email takes an arbitrary
  // address in the body and requires NO session, so it will mail any registered
  // unverified address on demand. It was inert while verification was never
  // wired; turning on `features.emailVerification` would arm it as a mail-bomb
  // relay against our own users. Worse, everything under /api/auth is dispatched
  // here via sendWebResponse, which ends the response — so the CSRF and
  // rate-limit middleware that run after this one never execute for it, and
  // Better Auth's own 3/60s cap is per-process, per-IP, and disabled outside
  // production. Close it and route callers to /api/user/resend-verification,
  // which is session-scoped, per-user rate limited, and cannot name a victim.
  if (pathname === '/api/auth/send-verification-email') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    });
  }

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
    await attachPermissions(event, event.context.auth);
  } catch (err: unknown) {
    // DB error during session resolution — don't silently eat it for API routes
    if (pathname.startsWith('/api/')) {
      console.error('[auth] Session resolution failed:', err instanceof Error ? err.message : err);
    }
    event.context.auth = { user: null, session: null };
  }
});
