import { eq, and, isNull } from 'drizzle-orm';
import { users, sessions } from '@commonpub/schema';
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
  let userId: string | undefined;
  let status: string | undefined;

  if (body.identity.includes('@')) {
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.email, body.identity), isNull(users.deletedAt)))
      .limit(1);
    userId = user?.id;
    status = user?.status;
  } else {
    // Username identity: resolve username → email.
    const [user] = await db
      .select({ id: users.id, email: users.email, status: users.status })
      .from(users)
      .where(and(eq(users.username, body.identity), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
    }
    email = user.email;
    userId = user.id;
    status = user.status;
  }

  // Proxy to Better Auth's email sign-in (internal server-side call) FIRST — the
  // password must be proven before we reveal anything account-specific. A wrong
  // password throws Better Auth's 401 here, indistinguishable from a nonexistent
  // account, so there is no pre-auth suspended-account enumeration oracle.
  // Forward Origin + Referer so Better Auth's CSRF protection accepts the request.
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

  // Credentials proven. NOW enforce ban/suspend: revoke the session Better Auth just
  // minted and return a clean 403 (the Set-Cookie below is never forwarded because we
  // throw first). enrichUser is the per-request belt; this is the useful error + cleanup.
  if (status && status !== 'active') {
    if (userId) await db.delete(sessions).where(eq(sessions.userId, userId));
    throw createError({ statusCode: 403, statusMessage: 'This account has been suspended' });
  }

  // Forward Set-Cookie headers from Better Auth's response
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    appendResponseHeader(event, 'Set-Cookie', cookie);
  }

  return response._data;
});
