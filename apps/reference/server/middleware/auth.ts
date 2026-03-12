// Nitro middleware for authentication using @commonpub/auth
import { createAuthMiddleware, type AuthLocals } from '@commonpub/auth';
import { createAuth } from '@commonpub/auth';

let authMiddleware: ReturnType<typeof createAuthMiddleware> | null = null;

function getAuthMiddleware(): ReturnType<typeof createAuthMiddleware> {
  if (authMiddleware) return authMiddleware;

  const config = useConfig();
  const db = useDB();

  const runtimeConfig = useRuntimeConfig();

  const auth = createAuth({
    config,
    db: db as Parameters<typeof createAuth>[0]['db'],
    secret: runtimeConfig.authSecret as string || 'dev-secret-change-me',
    baseURL: `https://${config.instance.domain}`,
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
  const middleware = getAuthMiddleware();
  const pathname = getRequestURL(event).pathname;

  // Handle auth API routes
  if (pathname.startsWith('/api/auth')) {
    const response = await middleware.handleAuthRoute(
      toWebRequest(event),
      pathname,
    );
    if (response) {
      return sendWebResponse(event, response);
    }
  }

  // Resolve session for all requests
  const headers = getRequestHeaders(event);
  const webHeaders = new Headers(headers as Record<string, string>);
  event.context.auth = await middleware.resolveSession(webHeaders);
});
