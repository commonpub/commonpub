import type { AuthInstance } from './createAuth';
import type { AuthUser, AuthSession } from './types';

export interface AuthLocals {
  user: AuthUser | null;
  session: AuthSession | null;
}

export interface CreateAuthHookOptions {
  auth: AuthInstance;
  authPathPrefix?: string;
}

/**
 * Creates a SvelteKit-compatible handle hook that resolves sessions
 * and delegates auth API routes to Better Auth's handler.
 */
export function createAuthHook({
  auth,
  authPathPrefix = '/api/auth',
}: CreateAuthHookOptions): (input: {
  event: { request: Request; url: URL; locals: Record<string, unknown> };
  resolve: (event: unknown) => Promise<Response>;
}) => Promise<Response> {
  return async ({ event, resolve }) => {
    // Delegate auth API routes to Better Auth's handler
    if (event.url.pathname.startsWith(authPathPrefix)) {
      return auth.handler(event.request);
    }

    // Resolve session for all other routes
    try {
      const session = await auth.api.getSession({
        headers: event.request.headers,
      });

      if (session) {
        event.locals.user = session.user as unknown as AuthUser;
        event.locals.session = session.session as unknown as AuthSession;
      } else {
        event.locals.user = null;
        event.locals.session = null;
      }
    } catch {
      event.locals.user = null;
      event.locals.session = null;
    }

    return resolve(event);
  };
}
