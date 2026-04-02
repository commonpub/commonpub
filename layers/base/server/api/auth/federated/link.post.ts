import { linkFederatedAccount, consumePendingLink } from '@commonpub/server';
import { z } from 'zod';

const linkSchema = z.object({
  /** Local credentials */
  identity: z.string().min(1),
  password: z.string().min(1),
  /** Server-side link token from the OAuth callback — proves the federated identity was verified */
  linkToken: z.string().min(1),
});

/**
 * Link a verified federated identity to a local account.
 * The linkToken is a server-side opaque token stored during the OAuth callback.
 * It proves the federated identity was authenticated — the actorUri is never
 * sent from the client, preventing identity hijacking.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const body = await parseBody(event, linkSchema);

  // Step 1: Consume the pending link token (single-use, 10min TTL)
  const pendingLink = await consumePendingLink(db, body.linkToken);
  if (!pendingLink) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Link token is invalid or expired. Please start the federated login again.',
    });
  }

  // Step 2: Resolve identity to email
  const { email } = await $fetch<{ email: string }>('/api/resolve-identity', {
    method: 'POST',
    body: { identity: body.identity },
  }).catch(() => {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials.' });
  });

  // Step 3: Authenticate via Better Auth sign-in (also creates session + sets cookie)
  const signInResponse = await $fetch<{ user?: { id: string }; session?: { token: string; expiresAt: string } }>(
    '/api/auth/sign-in/email',
    {
      method: 'POST',
      body: { email, password: body.password },
    },
  ).catch(() => {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials.' });
  });

  if (!signInResponse?.user?.id || !signInResponse?.session?.token) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials.' });
  }

  const userId = signInResponse.user.id;

  // Step 4: Link the verified federated identity (from server-side token, NOT client input)
  try {
    await linkFederatedAccount(db, userId, pendingLink.actorUri, pendingLink.instanceDomain, {
      preferredUsername: pendingLink.username,
      displayName: pendingLink.displayName,
      avatarUrl: pendingLink.avatarUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to link account';
    throw createError({ statusCode: 409, statusMessage: msg });
  }

  // Step 5: Use the session Better Auth created — set cookie for the client
  setCookie(event, 'better-auth.session_token', signInResponse.session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(signInResponse.session.expiresAt),
  });

  return {
    success: true,
    linked: true,
  };
});
