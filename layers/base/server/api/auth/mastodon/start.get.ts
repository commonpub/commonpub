/**
 * GET /api/auth/mastodon/start?host=<domain>[&returnTo=<path>]
 *
 * Phase 2a — server side of "Sign in via @user@host" / "Link a
 * Mastodon-API account". CommonPub plays the OAuth client role here:
 * registers itself with the remote, then redirects the user to the
 * remote's `/oauth/authorize`.
 *
 * Gated by `features.identity.signInWithRemote`. When the flag is off,
 * this route 404s — no leakage of new endpoints to scrapers.
 *
 * The companion `callback.get.ts` handles the auth code return.
 */
import { z } from 'zod';
import {
  buildAuthorizeUrl,
  getOrRegisterRemoteClient,
  isValidHost,
  storeMastodonLoginState,
} from '@commonpub/server';

const startSchema = z.object({
  host: z.string().min(3).max(253),
  returnTo: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.identity.signInWithRemote) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const db = useDB();
  const { host: rawHost, returnTo } = parseQueryParams(event, startSchema);
  const host = rawHost.trim().toLowerCase();

  if (!isValidHost(host)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid host: ${rawHost}`,
    });
  }

  const redirectUri = `https://${config.instance.domain}/api/auth/mastodon/callback`;

  // Get or register our OAuth client at the remote. First call to a
  // given host hits the network (megalodon's `registerApp` →
  // POST /api/v1/apps); subsequent calls read the cache.
  let creds: Awaited<ReturnType<typeof getOrRegisterRemoteClient>>;
  try {
    creds = await getOrRegisterRemoteClient(db, host, redirectUri);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown registration error';
    throw createError({
      statusCode: 502,
      statusMessage: `Could not register CommonPub at ${host}: ${msg}`,
    });
  }

  // Mint a CSRF state token bound to this (host, redirectUri, returnTo)
  // tuple. Single-use, 10-min TTL.
  const state = await storeMastodonLoginState(db, {
    host,
    redirectUri,
    returnTo,
  });

  // Redirect the user to the remote's authorize endpoint.
  const authUrl = buildAuthorizeUrl(host, creds, state);
  return sendRedirect(event, authUrl, 302);
});
