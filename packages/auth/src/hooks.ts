import type { AuthInstance } from './createAuth.js';
import type { AuthUser, AuthSession } from './types.js';

export interface AuthLocals {
  user: AuthUser | null;
  session: AuthSession | null;
}

export interface CreateAuthMiddlewareOptions {
  auth: AuthInstance;
  authPathPrefix?: string;
}

export interface AuthMiddleware {
  /**
   * Handle auth API routes. Returns a Response if the path matches
   * the auth prefix, or null if the path is not an auth route.
   */
  handleAuthRoute(request: Request, pathname: string): Promise<Response | null>;

  /**
   * Resolve the current session from request headers.
   * Returns the user and session, or nulls if not authenticated.
   */
  resolveSession(headers: Headers): Promise<AuthLocals>;
}

/**
 * Creates a framework-agnostic auth middleware.
 * Works with any server framework (Nuxt/Nitro, Express, Hono, etc.)
 */
export function createAuthMiddleware({
  auth,
  authPathPrefix = '/api/auth',
}: CreateAuthMiddlewareOptions): AuthMiddleware {
  return {
    async handleAuthRoute(request: Request, pathname: string): Promise<Response | null> {
      if (pathname.startsWith(authPathPrefix)) {
        return auth.handler(request);
      }
      return null;
    },

    async resolveSession(headers: Headers): Promise<AuthLocals> {
      try {
        const session = await auth.api.getSession({ headers });

        if (session) {
          return {
            user: session.user as unknown as AuthUser,
            session: session.session as unknown as AuthSession,
          };
        }
      } catch {
        // Session resolution failed — treat as unauthenticated
      }

      return { user: null, session: null };
    },
  };
}

// Keep backward compatibility export
/** @deprecated Use createAuthMiddleware instead */
export const createAuthHook = createAuthMiddleware;
