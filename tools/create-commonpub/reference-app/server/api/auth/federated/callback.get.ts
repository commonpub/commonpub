import { consumeOAuthState, exchangeCodeForToken, linkFederatedAccount } from '@commonpub/server';
import { z } from 'zod';

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

/**
 * OAuth2 callback handler for federated login.
 * Exchanges authorization code for token, links federated account.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const { code, state: stateToken } = parseQueryParams(event, callbackSchema);

  // Retrieve and consume the stored OAuth state (single-use, 10min TTL)
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

  // Check if a local user is already linked to this federated account
  const { findUserByFederatedAccount } = await import('@commonpub/server');
  const existingLink = await findUserByFederatedAccount(db, tokenResult.user.actorUri);

  if (existingLink) {
    // User already linked — redirect to dashboard
    // In a full implementation, this would also create a Better Auth session
    return sendRedirect(event, `/dashboard?federated=linked&user=${existingLink.username}`, 302);
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

  // Not logged in and no existing link — redirect to login page with federated context
  // The user needs to either create an account or log in to link
  const params = new URLSearchParams({
    federated: 'true',
    actorUri: tokenResult.user.actorUri,
    username: tokenResult.user.username,
    instance: oauthState.instanceDomain,
  });
  return sendRedirect(event, `/auth/login?${params.toString()}`, 302);
});
