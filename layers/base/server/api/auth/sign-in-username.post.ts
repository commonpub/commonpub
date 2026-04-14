import { resolveIdentityToEmail } from '@commonpub/server';
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

  let email: string;
  try {
    email = await resolveIdentityToEmail(useDB(), body.identity);
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
  }

  // Proxy to Better Auth's email sign-in (internal server-side call)
  const origin = getRequestURL(event).origin;
  const response = await $fetch.raw(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    body: { email, password: body.password },
    headers: {
      'Content-Type': 'application/json',
      Cookie: getRequestHeader(event, 'cookie') ?? '',
    },
  });

  // Forward Set-Cookie headers from Better Auth's response
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    appendResponseHeader(event, 'Set-Cookie', cookie);
  }

  return response._data;
});
