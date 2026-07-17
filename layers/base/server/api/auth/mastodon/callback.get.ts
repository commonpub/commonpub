/**
 * GET /api/auth/mastodon/callback?code=<auth_code>&state=<state>
 *
 * Phase 2a — server side of the Mastodon-login flow. Exchanges the
 * auth code for an access token, verifies the remote account, then
 * routes to one of three outcomes:
 *
 *   1. **Already linked** — `findUserByFederatedAccount` finds a local
 *      user. Mint a Better Auth session, redirect to dashboard. (Or
 *      to `returnTo` if the start request specified it.)
 *
 *   2. **Currently logged-in user adding a link** — `event.context.auth`
 *      has a user. Call `linkFederatedAccount` with the grant; redirect
 *      to settings.
 *
 *   3. **Anonymous + first-time** — call `storePendingLink` (existing
 *      v1 SSO machinery). Redirect to login form with the link token;
 *      Phase 2b's UI will consume the token to auto-provision a fresh
 *      local account or link to an existing user the visitor signs in
 *      as.
 *
 * Gated by `features.identity.signInWithRemote`.
 */
import { z } from 'zod';
import {
  consumeMastodonLoginState,
  createFederatedSession,
  exchangeCodeAndVerify,
  findUserByFederatedAccount,
  getOrRegisterRemoteClient,
  linkFederatedAccount,
  storePendingLink,
  getClientIp,
} from '@commonpub/server';
import { setBetterAuthSessionCookie } from '../../../utils/betterAuthCookie';

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  // OAuth error responses come back as ?error=...&error_description=...
  // We surface a friendly message rather than crashing.
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.identity.signInWithRemote) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const db = useDB();
  const params = parseQueryParams(event, callbackSchema);

  if (params.error) {
    // Remote denied / errored. Surface back to the login page with the
    // OAuth error message so the UI can render it cleanly.
    const msg = encodeURIComponent(params.error_description || params.error);
    return sendRedirect(event, `/auth/login?mastodon_error=${msg}`, 302);
  }

  // Single-use, atomic. Returns null if expired / already consumed.
  const loginState = await consumeMastodonLoginState(db, params.state);
  if (!loginState) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired login state. Please try again.',
    });
  }

  // Re-read the cached client credentials for this host; they were
  // stored by the start route during `getOrRegisterRemoteClient`.
  // Pass the same redirectUri so we don't mistakenly re-register.
  const creds = await getOrRegisterRemoteClient(db, loginState.host, loginState.redirectUri);

  // Exchange + verify in one atomic-ish step. Throws on token-exchange
  // failure or 4xx on verifyCredentials.
  let verified: Awaited<ReturnType<typeof exchangeCodeAndVerify>>;
  try {
    verified = await exchangeCodeAndVerify(loginState.host, creds, params.code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw createError({
      statusCode: 502,
      statusMessage: `Sign-in via ${loginState.host} failed: ${msg}`,
    });
  }

  // Trusted client IP for the session audit row (federation-hardening
  // Item 9 — see federated/callback.get.ts).
  const resolvedIp = getClientIp(event);
  const ipAddress = resolvedIp === 'unknown' ? undefined : resolvedIp;
  const userAgent = getRequestHeader(event, 'user-agent') ?? undefined;

  // Outcome 1: identity already linked → log them in, redirect.
  // Cookie minted via the Better Auth signed-cookie helper so
  // `auth.api.getSession` authenticates the next request
  // (federation-hardening Item 8 — bare-name/bare-value cookie was
  // rejected before).
  const existingLink = await findUserByFederatedAccount(db, verified.profile.actorUri);
  if (existingLink) {
    const session = await createFederatedSession(db, existingLink.userId, ipAddress, userAgent);
    setBetterAuthSessionCookie(event, session.sessionToken, session.expiresAt);
    // Only honor a same-origin returnTo. `returnTo` is attacker-suppliable via the /start
    // query and would otherwise be a post-auth open redirect. Resolve it against a throwaway
    // origin and keep it only if it stays on that origin — this defeats absolute URLs,
    // protocol-relative ('//evil'), backslash tricks AND control-char tricks (a browser strips
    // TAB/LF/CR before parsing, so a naive char-by-char regex is bypassable). We then forward
    // only pathname+search+hash so no scheme/host can survive.
    const safeReturnTo = ((rt: unknown): string => {
      if (typeof rt !== 'string' || !rt) return '/dashboard';
      try {
        const u = new URL(rt, 'https://cpub.invalid');
        if (u.origin !== 'https://cpub.invalid') return '/dashboard';
        return u.pathname + u.search + u.hash;
      } catch {
        return '/dashboard';
      }
    })(loginState.returnTo);
    return sendRedirect(event, safeReturnTo, 302);
  }

  // Outcome 2: a user is signed in locally and wants to add this link.
  const auth = event.context.auth;
  if (auth?.user) {
    await linkFederatedAccount(
      db,
      auth.user.id,
      verified.profile.actorUri,
      loginState.host,
      {
        preferredUsername: verified.profile.username,
        displayName: verified.profile.displayName,
        avatarUrl: verified.profile.avatarUrl,
      },
      {
        accessToken: verified.accessToken,
        scopes: verified.scopes,
        softwareKind: verified.softwareKind,
      },
    );
    return sendRedirect(event, '/settings/account?federated=linked', 302);
  }

  // Outcome 3: anonymous + first-time → store as pending link, hand
  // the opaque token to the login UI. Phase 2b's UI consumes the token.
  const linkToken = await storePendingLink(db, {
    actorUri: verified.profile.actorUri,
    username: verified.profile.username,
    instanceDomain: loginState.host,
    displayName: verified.profile.displayName,
    avatarUrl: verified.profile.avatarUrl,
  });
  return sendRedirect(event, `/auth/login?federated=true&linkToken=${linkToken}`, 302);
});
