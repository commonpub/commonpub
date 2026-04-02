import { consumeOAuthState, exchangeCodeForToken, linkFederatedAccount, findUserByFederatedAccount, createFederatedSession, storePendingLink } from '@commonpub/server';
import type { H3Event } from 'h3';
import { z } from 'zod';

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

/**
 * Set the Better Auth session cookie after federated login.
 */
function setSessionCookie(event: H3Event, token: string, expiresAt: Date): void {
  setCookie(event, 'better-auth.session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * OAuth2 callback handler for federated login.
 * Exchanges authorization code for token, links federated account,
 * creates a session, and redirects.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const { code, state: stateToken } = parseQueryParams(event, callbackSchema);

  // Retrieve and consume the stored OAuth state (single-use, atomic)
  const oauthState = await consumeOAuthState(db, stateToken);
  if (!oauthState) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired OAuth state. Please try logging in again.',
    });
  }

  // Exchange the authorization code for an access token + user info
  const tokenResult = await exchangeCodeForToken(oauthState, code);
  if (!tokenResult) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to exchange authorization code with the remote instance.',
    });
  }

  const ipAddress = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    ?? getRequestHeader(event, 'x-real-ip')
    ?? undefined;
  const userAgent = getRequestHeader(event, 'user-agent') ?? undefined;

  // Check if a local user is already linked to this federated account
  const existingLink = await findUserByFederatedAccount(db, tokenResult.user.actorUri);

  if (existingLink) {
    // User already linked — create session and redirect to dashboard
    const session = await createFederatedSession(db, existingLink.userId, ipAddress, userAgent);
    setSessionCookie(event, session.sessionToken, session.expiresAt);
    return sendRedirect(event, '/dashboard', 302);
  }

  // Check if the current user is logged in — if so, link to their account
  const auth = event.context.auth;
  if (auth?.user) {
    await linkFederatedAccount(db, auth.user.id, tokenResult.user.actorUri, oauthState.instanceDomain, {
      preferredUsername: tokenResult.user.username,
      displayName: tokenResult.user.displayName ?? undefined,
      avatarUrl: tokenResult.user.avatarUrl ?? undefined,
    });

    return sendRedirect(event, '/settings/account?federated=linked', 302);
  }

  // Not logged in and no existing link — store verified identity in a server-side token.
  // Only the opaque token is passed to the client; the actorUri is never exposed in the URL.
  const linkToken = await storePendingLink(db, {
    actorUri: tokenResult.user.actorUri,
    username: tokenResult.user.username,
    instanceDomain: oauthState.instanceDomain,
    displayName: tokenResult.user.displayName ?? undefined,
    avatarUrl: tokenResult.user.avatarUrl ?? undefined,
  });

  return sendRedirect(event, `/auth/login?federated=true&linkToken=${linkToken}`, 302);
});
