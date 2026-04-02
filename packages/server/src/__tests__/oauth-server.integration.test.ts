/**
 * OAuth2 authorization server integration tests.
 * Tests the full authorize → code → token exchange flow,
 * client registration, and federated account linking.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  processAuthorize,
  processTokenExchange,
  registerOAuthClient,
  linkFederatedAccount,
  findUserByFederatedAccount,
  listOAuthClients,
  storeOAuthState,
  consumeOAuthState,
  processDynamicRegistration,
  createFederatedSession,
  storePendingLink,
  consumePendingLink,
} from '../federation/oauth.js';
import { oauthClients, sessions } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

const DOMAIN = 'local.example.com';
const REMOTE_DOMAIN = 'remote.example.com';

describe('OAuth2 server integration', () => {
  let db: DB;
  let userId: string;
  let username: string;
  let clientId: string;
  let clientSecret: string;
  const redirectUri = `https://${REMOTE_DOMAIN}/api/auth/federated/callback`;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'oauthuser' });
    userId = user.id;
    username = user.username;

    // Register an OAuth client for the remote instance
    const client = await registerOAuthClient(db, REMOTE_DOMAIN, [redirectUri]);
    clientId = client.clientId;
    clientSecret = client.clientSecret;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('registerOAuthClient', () => {
    it('creates client with unique clientId and secret', () => {
      expect(clientId).toMatch(/^cpub_/);
      expect(clientSecret).toMatch(/^cpubs_/);
      expect(clientId.length).toBeGreaterThan(10);
      expect(clientSecret.length).toBeGreaterThan(30);
    });

    it('stores client in database', async () => {
      const clients = await listOAuthClients(db);
      const found = clients.find((c) => c.clientId === clientId);
      expect(found).toBeDefined();
      expect(found!.instanceDomain).toBe(REMOTE_DOMAIN);
    });
  });

  describe('processAuthorize', () => {
    it('generates authorization code for valid request', async () => {
      const result = await processAuthorize(
        db,
        {
          clientId,
          redirectUri,
          responseType: 'code',
          state: 'test-state-123',
        },
        userId,
        DOMAIN,
      );

      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toBeTruthy();
        expect(result.redirectUri).toBe(redirectUri);
        expect(result.state).toBe('test-state-123');
      }
    });

    it('rejects invalid client_id', async () => {
      const result = await processAuthorize(
        db,
        {
          clientId: 'nonexistent',
          redirectUri,
          responseType: 'code',
        },
        userId,
        DOMAIN,
      );

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('invalid_client');
      }
    });

    it('rejects invalid redirect_uri', async () => {
      const result = await processAuthorize(
        db,
        {
          clientId,
          redirectUri: 'https://evil.example.com/callback',
          responseType: 'code',
        },
        userId,
        DOMAIN,
      );

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('invalid_redirect_uri');
      }
    });

    it('rejects invalid response_type', async () => {
      const result = await processAuthorize(
        db,
        {
          clientId,
          redirectUri,
          responseType: 'token', // Must be 'code'
        },
        userId,
        DOMAIN,
      );

      expect('error' in result).toBe(true);
    });
  });

  describe('processTokenExchange', () => {
    it('exchanges valid code for token with user info', async () => {
      // First get an auth code
      const authResult = await processAuthorize(
        db,
        { clientId, redirectUri, responseType: 'code' },
        userId,
        DOMAIN,
      );
      expect('code' in authResult).toBe(true);
      if (!('code' in authResult)) return;

      // Exchange code for token
      const tokenResult = await processTokenExchange(
        db,
        {
          grantType: 'authorization_code',
          code: authResult.code,
          clientId,
          clientSecret,
          redirectUri,
        },
        DOMAIN,
      );

      expect('accessToken' in tokenResult).toBe(true);
      if ('accessToken' in tokenResult) {
        expect(tokenResult.accessToken).toBeTruthy();
        expect(tokenResult.tokenType).toBe('Bearer');
        expect(tokenResult.expiresIn).toBe(3600);
        expect(tokenResult.user.username).toBe(username);
        expect(tokenResult.user.actorUri).toBe(`https://${DOMAIN}/users/${username}`);
      }
    });

    it('rejects reused code (single-use)', async () => {
      // Get a code
      const authResult = await processAuthorize(
        db,
        { clientId, redirectUri, responseType: 'code' },
        userId,
        DOMAIN,
      );
      expect('code' in authResult).toBe(true);
      if (!('code' in authResult)) return;

      // First exchange succeeds
      const first = await processTokenExchange(
        db,
        {
          grantType: 'authorization_code',
          code: authResult.code,
          clientId,
          clientSecret,
          redirectUri,
        },
        DOMAIN,
      );
      expect('accessToken' in first).toBe(true);

      // Second exchange fails (code already consumed)
      const second = await processTokenExchange(
        db,
        {
          grantType: 'authorization_code',
          code: authResult.code,
          clientId,
          clientSecret,
          redirectUri,
        },
        DOMAIN,
      );
      expect('error' in second).toBe(true);
      if ('error' in second) {
        expect(second.error).toBe('invalid_grant');
      }
    });

    it('rejects wrong client_secret', async () => {
      const authResult = await processAuthorize(
        db,
        { clientId, redirectUri, responseType: 'code' },
        userId,
        DOMAIN,
      );
      if (!('code' in authResult)) return;

      const result = await processTokenExchange(
        db,
        {
          grantType: 'authorization_code',
          code: authResult.code,
          clientId,
          clientSecret: 'wrong-secret',
          redirectUri,
        },
        DOMAIN,
      );

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('invalid_client');
      }
    });

    it('rejects wrong grant_type', async () => {
      const result = await processTokenExchange(
        db,
        {
          grantType: 'password', // Must be 'authorization_code'
          code: 'doesnt-matter',
          clientId,
          clientSecret,
          redirectUri,
        },
        DOMAIN,
      );

      expect('error' in result).toBe(true);
    });
  });

  describe('federated account linking', () => {
    const remoteActorUri = `https://${REMOTE_DOMAIN}/users/alice`;

    it('links a federated account to a local user', async () => {
      await linkFederatedAccount(db, userId, remoteActorUri, REMOTE_DOMAIN, {
        preferredUsername: 'alice',
        displayName: 'Alice Remote',
      });

      const found = await findUserByFederatedAccount(db, remoteActorUri);
      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
      expect(found!.username).toBe(username);
    });

    it('updates existing linked account', async () => {
      await linkFederatedAccount(db, userId, remoteActorUri, REMOTE_DOMAIN, {
        displayName: 'Alice Updated',
        avatarUrl: 'https://remote.example.com/avatar.png',
      });

      // Should still find the same link
      const found = await findUserByFederatedAccount(db, remoteActorUri);
      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
    });

    it('returns null for unknown actor URI', async () => {
      const found = await findUserByFederatedAccount(db, 'https://unknown.example.com/users/nobody');
      expect(found).toBeNull();
    });

    it('rejects linking to a different user (identity hijacking prevention)', async () => {
      const otherActorUri = `https://${REMOTE_DOMAIN}/users/bob-hijack`;

      // First link succeeds
      await linkFederatedAccount(db, userId, otherActorUri, REMOTE_DOMAIN, {
        preferredUsername: 'bob-hijack',
      });

      // Create a second user
      const otherUser = await createTestUser(db, { username: 'attacker' });

      // Attempting to reassign the link to a different user should throw
      await expect(
        linkFederatedAccount(db, otherUser.id, otherActorUri, REMOTE_DOMAIN, {
          preferredUsername: 'bob-hijack',
        }),
      ).rejects.toThrow('already linked to another account');

      // Original link should be unchanged
      const found = await findUserByFederatedAccount(db, otherActorUri);
      expect(found!.userId).toBe(userId);
    });
  });

  describe('OAuth state management', () => {
    it('stores and retrieves state', async () => {
      const stateToken = await storeOAuthState(db, {
        tokenEndpoint: `https://${REMOTE_DOMAIN}/api/auth/oauth2/token`,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: `https://${DOMAIN}/api/auth/federated/callback`,
        instanceDomain: REMOTE_DOMAIN,
      });

      expect(stateToken).toBeTruthy();
      expect(stateToken.length).toBe(64); // 32 bytes hex

      const state = await consumeOAuthState(db, stateToken);
      expect(state).not.toBeNull();
      expect(state!.tokenEndpoint).toBe(`https://${REMOTE_DOMAIN}/api/auth/oauth2/token`);
      expect(state!.clientId).toBe('test-client');
      expect(state!.clientSecret).toBe('test-secret');
      expect(state!.instanceDomain).toBe(REMOTE_DOMAIN);
    });

    it('is single-use (second consume returns null)', async () => {
      const stateToken = await storeOAuthState(db, {
        tokenEndpoint: 'https://example.com/token',
        clientId: 'c1',
        clientSecret: 's1',
        redirectUri: 'https://example.com/callback',
        instanceDomain: 'example.com',
      });

      // First consume succeeds
      const first = await consumeOAuthState(db, stateToken);
      expect(first).not.toBeNull();

      // Second consume fails
      const second = await consumeOAuthState(db, stateToken);
      expect(second).toBeNull();
    });

    it('returns null for invalid state token', async () => {
      const state = await consumeOAuthState(db, 'nonexistent-state-token');
      expect(state).toBeNull();
    });

    it('returns null for expired state', async () => {
      const stateToken = await storeOAuthState(db, {
        tokenEndpoint: 'https://example.com/token',
        clientId: 'c2',
        clientSecret: 's2',
        redirectUri: 'https://example.com/callback',
        instanceDomain: 'example.com',
      });

      // Manually expire the state by overwriting the value
      const { instanceSettings } = await import('@commonpub/schema');
      const { eq } = await import('drizzle-orm');
      await db
        .update(instanceSettings)
        .set({
          value: {
            tokenEndpoint: 'https://example.com/token',
            clientId: 'c2',
            clientSecret: 's2',
            redirectUri: 'https://example.com/callback',
            instanceDomain: 'example.com',
            expiresAt: Date.now() - 1000, // Expired 1 second ago
          },
        })
        .where(eq(instanceSettings.key, `oauth_state:${stateToken}`));

      const state = await consumeOAuthState(db, stateToken);
      expect(state).toBeNull();
    });
  });

  describe('dynamic client registration', () => {
    it('registers a new client', async () => {
      const result = await processDynamicRegistration(db, {
        clientName: 'Remote Instance',
        redirectUris: ['https://other.example.com/api/auth/federated/callback'],
        instanceDomain: 'other.example.com',
      });

      expect('clientId' in result).toBe(true);
      if ('clientId' in result) {
        expect(result.clientId).toMatch(/^cpub_/);
        expect(result.clientSecret).toMatch(/^cpubs_/);
      }
    });

    it('is idempotent — returns existing credentials for same domain', async () => {
      const first = await processDynamicRegistration(db, {
        clientName: 'Same Domain',
        redirectUris: ['https://idempotent.example.com/callback'],
        instanceDomain: 'idempotent.example.com',
      });
      expect('clientId' in first).toBe(true);

      const second = await processDynamicRegistration(db, {
        clientName: 'Same Domain Again',
        redirectUris: ['https://idempotent.example.com/callback'],
        instanceDomain: 'idempotent.example.com',
      });
      expect('clientId' in second).toBe(true);

      if ('clientId' in first && 'clientId' in second) {
        expect(second.clientId).toBe(first.clientId);
      }
    });

    it('rejects missing clientName', async () => {
      const result = await processDynamicRegistration(db, {
        clientName: '',
        redirectUris: ['https://test.example.com/callback'],
        instanceDomain: 'test.example.com',
      });
      expect('error' in result).toBe(true);
    });

    it('rejects empty redirectUris', async () => {
      const result = await processDynamicRegistration(db, {
        clientName: 'Test',
        redirectUris: [],
        instanceDomain: 'test.example.com',
      });
      expect('error' in result).toBe(true);
    });

    it('rejects non-HTTPS redirect URIs (except localhost)', async () => {
      const result = await processDynamicRegistration(db, {
        clientName: 'Test',
        redirectUris: ['http://insecure.example.com/callback'],
        instanceDomain: 'insecure.example.com',
      });
      expect('error' in result).toBe(true);
    });

    it('allows localhost HTTP for development', async () => {
      const result = await processDynamicRegistration(db, {
        clientName: 'Dev Instance',
        redirectUris: ['http://localhost:3000/callback'],
        instanceDomain: 'localhost',
      });
      expect('clientId' in result).toBe(true);
    });
  });

  describe('createFederatedSession', () => {
    it('creates a session in the database', async () => {
      const result = await createFederatedSession(db, userId, '127.0.0.1', 'Test/1.0');

      expect(result.sessionToken).toBeTruthy();
      expect(result.sessionToken.length).toBe(64); // 32 bytes hex
      expect(result.userId).toBe(userId);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify session exists in DB
      const [row] = await db.select().from(sessions).where(eq(sessions.token, result.sessionToken)).limit(1);
      expect(row).toBeDefined();
      expect(row.userId).toBe(userId);
      expect(row.ipAddress).toBe('127.0.0.1');
      expect(row.userAgent).toBe('Test/1.0');
    });

    it('sets expiry to 7 days', async () => {
      const result = await createFederatedSession(db, userId);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const diff = result.expiresAt.getTime() - Date.now();
      // Should be within 5 seconds of 7 days
      expect(diff).toBeGreaterThan(sevenDaysMs - 5000);
      expect(diff).toBeLessThan(sevenDaysMs + 5000);
    });

    it('creates unique tokens for each call', async () => {
      const session1 = await createFederatedSession(db, userId);
      const session2 = await createFederatedSession(db, userId);
      expect(session1.sessionToken).not.toBe(session2.sessionToken);
    });
  });

  describe('pending link tokens', () => {
    it('stores and consumes a pending link', async () => {
      const token = await storePendingLink(db, {
        actorUri: `https://${REMOTE_DOMAIN}/users/pendingalice`,
        username: 'pendingalice',
        instanceDomain: REMOTE_DOMAIN,
        displayName: 'Pending Alice',
      });

      expect(token).toBeTruthy();
      expect(token.length).toBe(64);

      const data = await consumePendingLink(db, token);
      expect(data).not.toBeNull();
      expect(data!.actorUri).toBe(`https://${REMOTE_DOMAIN}/users/pendingalice`);
      expect(data!.username).toBe('pendingalice');
      expect(data!.instanceDomain).toBe(REMOTE_DOMAIN);
      expect(data!.displayName).toBe('Pending Alice');
    });

    it('is single-use (second consume returns null)', async () => {
      const token = await storePendingLink(db, {
        actorUri: `https://${REMOTE_DOMAIN}/users/singleuse`,
        username: 'singleuse',
        instanceDomain: REMOTE_DOMAIN,
      });

      const first = await consumePendingLink(db, token);
      expect(first).not.toBeNull();

      const second = await consumePendingLink(db, token);
      expect(second).toBeNull();
    });

    it('returns null for invalid token', async () => {
      const data = await consumePendingLink(db, 'nonexistent-token');
      expect(data).toBeNull();
    });

    it('returns null for expired token', async () => {
      const token = await storePendingLink(db, {
        actorUri: `https://${REMOTE_DOMAIN}/users/expired`,
        username: 'expired',
        instanceDomain: REMOTE_DOMAIN,
      });

      // Manually expire the token
      const { instanceSettings } = await import('@commonpub/schema');
      await db
        .update(instanceSettings)
        .set({
          value: {
            actorUri: `https://${REMOTE_DOMAIN}/users/expired`,
            username: 'expired',
            instanceDomain: REMOTE_DOMAIN,
            expiresAt: Date.now() - 1000,
          },
        })
        .where(eq(instanceSettings.key, `pending_link:${token}`));

      const data = await consumePendingLink(db, token);
      expect(data).toBeNull();
    });
  });
});
