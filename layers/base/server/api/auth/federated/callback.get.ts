import { consumeOAuthState, exchangeCodeForToken, linkFederatedAccount, findUserByFederatedAccount, createFederatedSession, storePendingLink, getClientIp } from '@commonpub/server';
import { z } from 'zod';
import { setBetterAuthSessionCookie } from '../../../utils/betterAuthCookie';

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

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

  // Trusted client IP for the session audit row (federation-hardening
  // Item 9 — use the rightmost XFF token / x-real-ip / socket address,
  // matching the rate-limit middleware so the audit log + the rate-limit
  // key reference the same address).
  const resolvedIp = getClientIp(event);
  const ipAddress = resolvedIp === 'unknown' ? undefined : resolvedIp;
  const userAgent = getRequestHeader(event, 'user-agent') ?? undefined;

  // Check if a local user is already linked to this federated account
  const existingLink = await findUserByFederatedAccount(db, tokenResult.user.actorUri);

  if (existingLink) {
    // User already linked — create session and redirect to dashboard.
    // Cookie is signed + correctly named (federation-hardening Item 8);
    // before the fix the bare-token/bare-name cookie was rejected by
    // Better Auth's getSession on the next request, leaving the redirect
    // anonymous.
    const session = await createFederatedSession(db, existingLink.userId, ipAddress, userAgent);
    setBetterAuthSessionCookie(event, session.sessionToken, session.expiresAt);
    return sendRedirect(event, '/dashboard', 302);
  }

  // Check if the current user is logged in — if so, link to their account
  const auth = event.context.auth;
  if (auth?.user) {
    await linkFederatedAccount(
      db,
      auth.user.id,
      tokenResult.user.actorUri,
      oauthState.instanceDomain,
      {
        preferredUsername: tokenResult.user.username,
        displayName: tokenResult.user.displayName ?? undefined,
        avatarUrl: tokenResult.user.avatarUrl ?? undefined,
      },
      // Phase 1b: persist the access token so future delegated actions
      // (Phase 4) can call the remote on this user's behalf. Encrypted
      // at rest via @commonpub/infra/tokenCrypto. Scopes default to
      // 'read write follow' for CommonPub↔CommonPub trust (the existing
      // SSO model assumes mutual trustedInstances). Software-kind is
      // 'cpub' here because this callback handles CommonPub→CommonPub;
      // a Mastodon-login flow (Phase 2) will use a separate callback
      // that detects software via WebFinger / megalodon.
      {
        accessToken: tokenResult.accessToken,
        scopes: ['read', 'write', 'follow'],
        softwareKind: 'cpub',
      },
    );

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
