/**
 * OAuth2 authorization server and client functions for federation SSO.
 * Implements the server side (authorize + token endpoints) and
 * client side (initiate login + handle callback) of cross-instance SSO.
 */
import { eq, and, lt } from 'drizzle-orm';
import {
  oauthClients,
  oauthCodes,
  users,
  federatedAccounts,
  instanceSettings,
} from '@commonpub/schema';
import {
  validateAuthorizeRequest,
  validateTokenRequest,
  validateDynamicRegistration,
  type OAuthAuthorizeRequest,
  type OAuthTokenRequest,
  type OAuthDynamicRegistrationRequest,
} from '@commonpub/protocol';
import type { DB } from '../types.js';
import { storeAuthCode, consumeAuthCode } from '../oauthCodes.js';

/** Generate a cryptographically secure random token (hex-encoded, 256 bits) */
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// --- OAuth2 Authorization Server ---

export interface AuthorizeResult {
  /** Authorization code to return to the client */
  code: string;
  /** Redirect URI to send the user back to */
  redirectUri: string;
  /** State parameter to pass through */
  state?: string;
}

export interface TokenResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  /** User info embedded in token response */
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    actorUri: string;
  };
}

/**
 * Process an OAuth2 authorization request.
 * Validates the client, generates an auth code, returns redirect info.
 * Called after user consents on the authorize page.
 */
export async function processAuthorize(
  db: DB,
  params: OAuthAuthorizeRequest,
  userId: string,
  domain: string,
): Promise<AuthorizeResult | { error: string; errorDescription: string }> {
  // Look up the client
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, params.clientId))
    .limit(1);

  const oauthClient = client
    ? {
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        redirectUris: client.redirectUris as string[],
        instanceDomain: client.instanceDomain,
      }
    : null;

  // Validate the request
  const validationError = validateAuthorizeRequest(params, oauthClient);
  if (validationError) return validationError;

  // Generate authorization code (cryptographically secure, 32 bytes = 256 bits)
  const code = generateSecureToken();
  await storeAuthCode(db, code, userId, params.clientId, params.redirectUri);

  return {
    code,
    redirectUri: params.redirectUri,
    state: params.state,
  };
}

/**
 * Exchange an authorization code for an access token.
 * Validates the client credentials and code, returns user info.
 */
export async function processTokenExchange(
  db: DB,
  params: OAuthTokenRequest,
  domain: string,
): Promise<TokenResult | { error: string; errorDescription: string }> {
  // Look up the client
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, params.clientId))
    .limit(1);

  const oauthClient = client
    ? {
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        redirectUris: client.redirectUris as string[],
        instanceDomain: client.instanceDomain,
      }
    : null;

  // Validate the request
  const validationError = validateTokenRequest(params, oauthClient);
  if (validationError) return validationError;

  // Consume the auth code (single-use)
  const codeResult = await consumeAuthCode(db, params.code, params.clientId, params.redirectUri);
  if (!codeResult) {
    return { error: 'invalid_grant', errorDescription: 'Invalid or expired authorization code' };
  }

  // Look up the user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, codeResult.userId))
    .limit(1);

  if (!user) {
    return { error: 'server_error', errorDescription: 'User not found' };
  }

  // Generate a cryptographically secure access token
  const accessToken = generateSecureToken();
  const actorUri = `https://${domain}/users/${user.username}`;

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      actorUri,
    },
  };
}

// --- OAuth2 Client (Sign in with Instance) ---

export interface RegisteredClient {
  clientId: string;
  clientSecret: string;
}

/**
 * Register this instance as an OAuth client with a remote instance.
 * In v1, this is done manually by admins. Returns client credentials for storage.
 */
export async function registerOAuthClient(
  db: DB,
  instanceDomain: string,
  redirectUris: string[],
): Promise<RegisteredClient> {
  const clientId = `cpub_${generateSecureToken().slice(0, 32)}`;
  const clientSecret = `cpubs_${generateSecureToken()}`;

  await db.insert(oauthClients).values({
    clientId,
    clientSecret,
    redirectUris,
    instanceDomain,
  });

  return { clientId, clientSecret };
}

/**
 * Link a federated account to a local user after successful OAuth callback.
 */
export async function linkFederatedAccount(
  db: DB,
  userId: string,
  actorUri: string,
  instanceDomain: string,
  profile?: { preferredUsername?: string; displayName?: string; avatarUrl?: string },
): Promise<void> {
  // Check if already linked
  const existing = await db
    .select()
    .from(federatedAccounts)
    .where(eq(federatedAccounts.actorUri, actorUri))
    .limit(1);

  if (existing.length > 0) {
    // Update the link
    await db
      .update(federatedAccounts)
      .set({
        userId,
        lastSyncedAt: new Date(),
        ...(profile?.preferredUsername && { preferredUsername: profile.preferredUsername }),
        ...(profile?.displayName && { displayName: profile.displayName }),
        ...(profile?.avatarUrl && { avatarUrl: profile.avatarUrl }),
      })
      .where(eq(federatedAccounts.actorUri, actorUri));
  } else {
    await db.insert(federatedAccounts).values({
      userId,
      actorUri,
      instanceDomain,
      preferredUsername: profile?.preferredUsername,
      displayName: profile?.displayName,
      avatarUrl: profile?.avatarUrl,
      lastSyncedAt: new Date(),
    });
  }
}

/**
 * Find a local user linked to a federated account by actor URI.
 */
export async function findUserByFederatedAccount(
  db: DB,
  actorUri: string,
): Promise<{ userId: string; username: string } | null> {
  const rows = await db
    .select({
      userId: federatedAccounts.userId,
      username: users.username,
    })
    .from(federatedAccounts)
    .innerJoin(users, eq(federatedAccounts.userId, users.id))
    .where(eq(federatedAccounts.actorUri, actorUri))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * List registered OAuth clients (for admin panel).
 */
export async function listOAuthClients(
  db: DB,
): Promise<Array<{ id: string; clientId: string; instanceDomain: string; createdAt: Date }>> {
  return db
    .select({
      id: oauthClients.id,
      clientId: oauthClients.clientId,
      instanceDomain: oauthClients.instanceDomain,
      createdAt: oauthClients.createdAt,
    })
    .from(oauthClients);
}

// --- Dynamic Client Registration ---

/**
 * Process a dynamic OAuth client registration request.
 * Idempotent: if a client already exists for this domain, returns existing credentials.
 */
export async function processDynamicRegistration(
  db: DB,
  request: OAuthDynamicRegistrationRequest,
): Promise<{ clientId: string; clientSecret: string } | { error: string; errorDescription: string }> {
  const validationError = validateDynamicRegistration(request);
  if (validationError) return validationError;

  // Check for existing client with this domain (idempotent)
  const [existing] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.instanceDomain, request.instanceDomain))
    .limit(1);

  if (existing) {
    return { clientId: existing.clientId, clientSecret: existing.clientSecret };
  }

  // Register new client
  const result = await registerOAuthClient(db, request.instanceDomain, request.redirectUris);
  return result;
}

// --- OAuth State Management (for federated login flow) ---

const OAUTH_STATE_PREFIX = 'oauth_state:';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthLoginState {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  instanceDomain: string;
  expiresAt: number;
}

/**
 * Store OAuth login state for the federated login flow.
 * Returns a state token that should be passed to the remote authorize endpoint.
 */
export async function storeOAuthState(
  db: DB,
  state: Omit<OAuthLoginState, 'expiresAt'>,
): Promise<string> {
  const stateToken = generateSecureToken();
  const key = `${OAUTH_STATE_PREFIX}${stateToken}`;

  await db.insert(instanceSettings).values({
    key,
    value: {
      ...state,
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    },
  });

  return stateToken;
}

/**
 * Consume OAuth login state (single-use). Returns null if expired or not found.
 */
export async function consumeOAuthState(
  db: DB,
  stateToken: string,
): Promise<OAuthLoginState | null> {
  const key = `${OAUTH_STATE_PREFIX}${stateToken}`;

  const rows = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, key))
    .limit(1);

  if (rows.length === 0) return null;

  // Delete immediately (single-use)
  await db.delete(instanceSettings).where(eq(instanceSettings.key, key));

  const state = rows[0]!.value as OAuthLoginState;

  // Check expiry
  if (Date.now() > state.expiresAt) return null;

  return state;
}

/**
 * Exchange an authorization code with a remote instance's token endpoint.
 */
export async function exchangeCodeForToken(
  state: OAuthLoginState,
  code: string,
): Promise<{
  accessToken: string;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; actorUri: string };
} | null> {
  try {
    const response = await fetch(state.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: state.clientId,
        client_secret: state.clientSecret,
        redirect_uri: state.redirectUri,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      access_token?: string;
      user?: { id: string; username: string; displayName?: string | null; avatarUrl?: string | null; actorUri?: string };
    };

    if (!data.access_token || !data.user) return null;

    return {
      accessToken: data.access_token,
      user: {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName ?? null,
        avatarUrl: data.user.avatarUrl ?? null,
        actorUri: data.user.actorUri ?? `https://${state.instanceDomain}/users/${data.user.username}`,
      },
    };
  } catch {
    return null;
  }
}
