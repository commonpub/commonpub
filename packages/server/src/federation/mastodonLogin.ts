/**
 * Mastodon-API "sign in via host" flow — server-side helpers.
 *
 * This is the OUTBOUND direction of OAuth: CommonPub registers itself
 * as a CLIENT of any Mastodon-API-compatible remote instance, redirects
 * the user to the remote's `/oauth/authorize`, then exchanges the
 * returned code for an access token and persists the grant via
 * `linkFederatedAccount`.
 *
 * Distinct from the existing v1 SSO `oauth.ts` flow — that's CommonPub
 * acting as the *server* of OAuth (other CommonPub instances register
 * with us). This module is CommonPub acting as the *client*.
 *
 * Phase 2a slice (server-side only — no UI yet):
 *   - `getOrRegisterRemoteClient(db, host)` — get-or-create our client
 *     credentials at `host` via megalodon's `registerApp`. Cached in
 *     `instance_settings` keyed by `mastodon_client:{host}` so
 *     subsequent links to the same host don't re-register.
 *   - `buildAuthorizeUrl(host, creds, state, redirectUri)` — assemble
 *     the URL we redirect the user to.
 *   - `exchangeCodeAndVerify(host, creds, code, redirectUri)` — exchange
 *     the auth code for a token, then call `verifyAccountCredentials`
 *     to confirm identity. Returns the verified account + the
 *     plaintext access token (caller encrypts via `linkFederatedAccount`'s
 *     grant param).
 *   - `detectSoftwareKind(host)` — megalodon's `detector` (NodeInfo
 *     probe), narrowed to our `SoftwareKind` enum.
 *
 * State management piggybacks on the existing `instance_settings`
 * KV store with key prefixes `mastodon_login_state:` (CSRF) and
 * `mastodon_client:` (cached client credentials). 10-minute TTL on
 * state; persistent on credentials.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md.
 */
import { eq } from 'drizzle-orm';
import generator, { detector } from 'megalodon';
import { instanceSettings } from '@commonpub/schema';
import type { SoftwareKind } from '@commonpub/auth';
import type { DB } from '../types.js';

const CLIENT_PREFIX = 'mastodon_client:';
const STATE_PREFIX = 'mastodon_login_state:';
const STATE_TTL_MS = 10 * 60 * 1000;
const CLIENT_NAME = 'CommonPub';
const APP_WEBSITE = 'https://commonpub.io';
const SCOPES = ['read', 'write', 'follow'];

/** megalodon's narrower SNS enum; ours is broader. */
type MegalodonSns = Awaited<ReturnType<typeof detector>>;

export interface RemoteClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  registeredAt: number;
}

export interface MastodonLoginState {
  host: string;
  redirectUri: string;
  expiresAt: number;
  /** Optional: where to redirect the user back after login completes. */
  returnTo?: string;
}

export interface VerifiedRemoteAccount {
  /** Plaintext access token — caller encrypts via grant param. */
  accessToken: string;
  /** Granted scopes from the token endpoint. */
  scopes: ReadonlyArray<string>;
  /** Detected remote software (our enum). */
  softwareKind: SoftwareKind;
  /** Profile fields suitable for `linkFederatedAccount`'s `profile` param. */
  profile: {
    actorUri: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

/**
 * Generate a cryptographically secure random token (hex-encoded, 256 bits).
 * Exported so the route handlers can use the same pattern.
 */
export function generateLoginStateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate that a host string looks like a domain we can OAuth against.
 * Loose check — the actual liveness probe happens on the megalodon
 * `registerApp` call. This catches obvious garbage (empty strings,
 * URL paths, etc.) before we hit the network.
 */
export function isValidHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const normalized = host.trim().toLowerCase();
  if (normalized.length > 253) return false;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(normalized)) return false;
  if (!normalized.includes('.')) return false;
  return true;
}

/**
 * Get-or-register CommonPub's OAuth client credentials at the given
 * remote host. Reads from `instance_settings` cache; if not present,
 * calls megalodon's `registerApp` (POST /api/v1/apps for Mastodon),
 * caches the result, and returns it.
 *
 * Idempotent per (host, redirectUri) — though Mastodon's /apps
 * endpoint always creates a fresh row, the cache means subsequent
 * calls return the same credentials.
 */
export async function getOrRegisterRemoteClient(
  db: DB,
  host: string,
  redirectUri: string,
): Promise<RemoteClientCredentials> {
  if (!isValidHost(host)) {
    throw new Error(`Invalid host for Mastodon-login: ${host}`);
  }
  const key = `${CLIENT_PREFIX}${host}`;
  const [cached] = await db.select().from(instanceSettings).where(eq(instanceSettings.key, key)).limit(1);
  if (cached) {
    const value = cached.value as RemoteClientCredentials;
    // Re-use only if redirectUri matches; otherwise re-register.
    if (value.redirectUri === redirectUri) return value;
  }

  // Register fresh. We don't know the software yet — use 'mastodon' as
  // the registration target since the Mastodon /api/v1/apps endpoint
  // is the de-facto standard implemented by Pleroma, GoToSocial, etc.
  const baseUrl = `https://${host}`;
  const client = generator('mastodon', baseUrl);
  const app = await client.registerApp(CLIENT_NAME, {
    scopes: SCOPES,
    redirect_uris: redirectUri,
    website: APP_WEBSITE,
  });

  const creds: RemoteClientCredentials = {
    clientId: app.client_id,
    clientSecret: app.client_secret,
    redirectUri,
    registeredAt: Date.now(),
  };
  if (cached) {
    await db.update(instanceSettings).set({ value: creds }).where(eq(instanceSettings.key, key));
  } else {
    await db.insert(instanceSettings).values({ key, value: creds });
  }
  return creds;
}

/**
 * Build the URL the user is redirected to in order to authorize CommonPub
 * at the remote instance's `/oauth/authorize` endpoint.
 */
export function buildAuthorizeUrl(
  host: string,
  creds: RemoteClientCredentials,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: creds.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
  });
  return `https://${host}/oauth/authorize?${params.toString()}`;
}

/**
 * Persist a CSRF state token mapping for the Mastodon-login flow.
 * Single-use, 10-minute TTL. Returns the opaque state token to put
 * in the authorize URL.
 */
export async function storeMastodonLoginState(
  db: DB,
  state: Omit<MastodonLoginState, 'expiresAt'>,
): Promise<string> {
  const token = generateLoginStateToken();
  const key = `${STATE_PREFIX}${token}`;
  await db.insert(instanceSettings).values({
    key,
    value: { ...state, expiresAt: Date.now() + STATE_TTL_MS },
  });
  return token;
}

/**
 * Atomic delete-and-return. Single-use; second attempt returns null.
 * Returns null if expired.
 */
export async function consumeMastodonLoginState(
  db: DB,
  token: string,
): Promise<MastodonLoginState | null> {
  const key = `${STATE_PREFIX}${token}`;
  const deleted = await db.delete(instanceSettings).where(eq(instanceSettings.key, key)).returning();
  if (deleted.length === 0) return null;
  const state = deleted[0]!.value as MastodonLoginState;
  if (Date.now() > state.expiresAt) return null;
  return state;
}

/**
 * Detect the remote's AP server software via NodeInfo, then narrow to
 * our `SoftwareKind` enum. Falls back to 'unknown' on detector failure.
 *
 * Mapping from megalodon's detector return values:
 *   'mastodon'   → 'mastodon'
 *   'pleroma'    → 'pleroma'    (Akkoma also reports as 'pleroma')
 *   'firefish'   → 'firefish'
 *   'gotosocial' → 'gotosocial'
 *   'friendica'  → 'unknown'    (not in our enum yet)
 *   'pixelfed'   → 'unknown'    (not in our enum yet)
 */
export async function detectSoftwareKind(host: string): Promise<SoftwareKind> {
  try {
    const sns = await detector(`https://${host}`);
    return mapDetectorToSoftwareKind(sns);
  } catch {
    return 'unknown';
  }
}

function mapDetectorToSoftwareKind(sns: MegalodonSns): SoftwareKind {
  switch (sns) {
    case 'mastodon': return 'mastodon';
    case 'pleroma': return 'pleroma';
    case 'firefish': return 'firefish';
    case 'gotosocial': return 'gotosocial';
    // Friendica + Pixelfed don't have direct mappings — bucket as
    // 'unknown'. They still get the Mastodon-API treatment downstream
    // since megalodon abstracts the differences.
    case 'friendica': return 'unknown';
    case 'pixelfed': return 'unknown';
  }
}

/**
 * Exchange the OAuth code for a token, then verify the user's identity
 * at the remote. Returns the plaintext access token + verified profile —
 * the caller encrypts via `linkFederatedAccount`'s grant param.
 *
 * Throws on:
 *   - Token exchange failure (invalid code, network, etc.)
 *   - verifyAccountCredentials returning a 4xx
 */
export async function exchangeCodeAndVerify(
  host: string,
  creds: RemoteClientCredentials,
  code: string,
): Promise<VerifiedRemoteAccount> {
  const baseUrl = `https://${host}`;
  const softwareKind = await detectSoftwareKind(host);
  const sns = softwareKind === 'mastodon' || softwareKind === 'pleroma'
    || softwareKind === 'firefish' || softwareKind === 'gotosocial'
    ? softwareKind
    : 'mastodon'; // unknown → fall back to mastodon dialect

  // Pre-token-exchange client (no token yet)
  const client = generator(sns, baseUrl);
  const tokenData = await client.fetchAccessToken(
    creds.clientId,
    creds.clientSecret,
    code,
    creds.redirectUri,
  );

  // Now construct an authenticated client to verify
  const authedClient = generator(sns, baseUrl, tokenData.access_token);
  const accountResp = await authedClient.verifyAccountCredentials();
  const account = accountResp.data;

  // Mastodon's `acct` for local users is just the bare username; for
  // remote users it's `user@host`. We're dealing with the user's home
  // instance here so `acct` should be the bare username.
  const username = account.username;
  const actorUri = account.url || `${baseUrl}/users/${username}`;

  // Mastodon returns scope as a space-separated string OR null;
  // megalodon types it null|string.
  const grantedScopes = tokenData.scope
    ? tokenData.scope.split(/\s+/).filter(Boolean)
    : SCOPES;

  return {
    accessToken: tokenData.access_token,
    scopes: grantedScopes,
    softwareKind,
    profile: {
      actorUri,
      username,
      displayName: account.display_name || undefined,
      avatarUrl: account.avatar || undefined,
    },
  };
}
