import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { z } from 'zod';

const signInSchema = z.object({
  identity: z.string().min(1).max(255),
  password: z.string().min(1).max(256),
});

/**
 * Sign in with username or email + password.
 * Resolves username → email server-side, then proxies to Better Auth's
 * email sign-in endpoint. The email is never exposed to the client.
 */
export default defineEventHandler(async (event) => {
  const body = await parseBody(event, signInSchema);

  const db = useDB();
  let email = body.identity;
  let status: string | undefined;

  if (body.identity.includes('@')) {
    // Email identity: look up status without leaking existence — fall through to
    // Better Auth's 401 when no row matches (no account-enumeration oracle).
    const [user] = await db
      .select({ status: users.status })
      .from(users)
      .where(and(eq(users.email, body.identity), isNull(users.deletedAt)))
      .limit(1);
    status = user?.status;
  } else {
    // Username identity: resolve username → email.
    const [user] = await db
      .select({ email: users.email, status: users.status })
      .from(users)
      .where(and(eq(users.username, body.identity), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
    }
    email = user.email;
    status = user.status;
  }

  // Ban/suspend enforcement at login: a suspended/deleted account gets a clean 403
  // rather than a silently-anonymous session (enrichUser is the belt; this is the
  // suspenders + a useful error).
  if (status && status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'This account has been suspended' });
  }

  // Proxy to Better Auth's email sign-in (internal server-side call)
  // Forward Origin + Referer so Better Auth's CSRF protection accepts the request
  const requestUrl = getRequestURL(event);
  const origin = requestUrl.origin;
  const clientOrigin = getRequestHeader(event, 'origin') || origin;
  const response = await $fetch.raw(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    body: { email, password: body.password },
    headers: {
      'Content-Type': 'application/json',
      Cookie: getRequestHeader(event, 'cookie') ?? '',
      Origin: clientOrigin,
      Referer: getRequestHeader(event, 'referer') || `${clientOrigin}/auth/login`,
    },
  });

  // Forward Set-Cookie headers from Better Auth's response
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    appendResponseHeader(event, 'Set-Cookie', cookie);
  }

  return response._data;
});
