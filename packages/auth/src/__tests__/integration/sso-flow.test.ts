import { describe, it, expect, vi } from 'vitest';
import { createSSOProviderConfig, discoverOAuthEndpoint, isTrustedInstance } from '../../sso';
import { buildWebFingerResponse } from '@snaplify/snaplify';
import { validateAuthorizeRequest, validateTokenRequest } from '@snaplify/snaplify';
import type { OAuthClient } from '@snaplify/snaplify';

/**
 * Integration test: AP Actor SSO flow (Model B)
 *
 * Simulates two Snaplify instances exchanging OAuth SSO logins.
 * All network calls are mocked at the fetch level.
 */

const instanceAConfig = {
  instance: { domain: 'instance-a.example.com', name: 'Instance A', description: 'Test A' },
  features: {
    communities: true, docs: true, video: true, contests: false,
    learning: true, explainers: true, federation: true,
  },
  auth: {
    emailPassword: true, magicLink: false, passkeys: false,
    trustedInstances: ['instance-b.example.com'],
  },
} as any;

const instanceBConfig = {
  instance: { domain: 'instance-b.example.com', name: 'Instance B', description: 'Test B' },
  features: {
    communities: true, docs: true, video: true, contests: false,
    learning: true, explainers: true, federation: true,
  },
  auth: {
    emailPassword: true, magicLink: false, passkeys: false,
    trustedInstances: ['instance-a.example.com'],
  },
} as any;

// Instance B is registered as an OAuth client on Instance A
const registeredClient: OAuthClient = {
  clientId: 'instance-b-client-id',
  clientSecret: 'instance-b-client-secret',
  redirectUris: ['https://instance-b.example.com/api/auth/callback/snaplify-sso'],
  instanceDomain: 'instance-b.example.com',
};

describe('AP Actor SSO Flow (Model B)', () => {
  it('Step 1: Instance A generates SSO provider config', () => {
    const providerConfig = createSSOProviderConfig(instanceAConfig);

    expect(providerConfig).not.toBeNull();
    expect(providerConfig!.issuer).toBe('https://instance-a.example.com');
    expect(providerConfig!.authorizationEndpoint).toBe(
      'https://instance-a.example.com/api/auth/oauth2/authorize',
    );
    expect(providerConfig!.tokenEndpoint).toBe(
      'https://instance-a.example.com/api/auth/oauth2/token',
    );
  });

  it('Step 2: Instance B verifies Instance A is trusted', () => {
    expect(isTrustedInstance(instanceBConfig, 'instance-a.example.com')).toBe(true);
    expect(isTrustedInstance(instanceBConfig, 'evil.example.com')).toBe(false);
  });

  it('Step 3: Instance B discovers OAuth endpoint via WebFinger', async () => {
    // Mock Instance A's WebFinger response
    const webfingerResponse = buildWebFingerResponse({
      username: 'alice',
      domain: 'instance-a.example.com',
      actorUri: 'https://instance-a.example.com/users/alice',
      oauthEndpoint: 'https://instance-a.example.com/api/auth/oauth2/authorize',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => webfingerResponse,
    });

    const discovery = await discoverOAuthEndpoint(
      'instance-a.example.com',
      'alice',
      mockFetch,
    );

    expect(discovery).not.toBeNull();
    expect(discovery!.authorizationEndpoint).toBe(
      'https://instance-a.example.com/api/auth/oauth2/authorize',
    );
    expect(discovery!.tokenEndpoint).toBe(
      'https://instance-a.example.com/api/auth/oauth2/token',
    );
    expect(discovery!.domain).toBe('instance-a.example.com');
  });

  it('Step 4: Instance A validates the OAuth authorize request', () => {
    const error = validateAuthorizeRequest(
      {
        clientId: 'instance-b-client-id',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
        responseType: 'code',
        scope: 'openid profile',
        state: 'random-state-123',
      },
      registeredClient,
    );

    expect(error).toBeNull();
  });

  it('Step 5: Instance A rejects unregistered client', () => {
    const error = validateAuthorizeRequest(
      {
        clientId: 'evil-client-id',
        redirectUri: 'https://evil.com/callback',
        responseType: 'code',
      },
      null,
    );

    expect(error).not.toBeNull();
    expect(error!.error).toBe('invalid_client');
  });

  it('Step 6: Instance A validates the token exchange', () => {
    const error = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'auth-code-abc123',
        clientId: 'instance-b-client-id',
        clientSecret: 'instance-b-client-secret',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
      },
      registeredClient,
    );

    expect(error).toBeNull();
  });

  it('Step 7: Instance A rejects wrong client secret in token exchange', () => {
    const error = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'auth-code-abc123',
        clientId: 'instance-b-client-id',
        clientSecret: 'wrong-secret',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
      },
      registeredClient,
    );

    expect(error).not.toBeNull();
    expect(error!.error).toBe('invalid_client');
  });

  it('Full flow: WebFinger → Authorize → Token validates end-to-end', async () => {
    // 1. Instance B discovers Instance A
    const webfingerResponse = buildWebFingerResponse({
      username: 'alice',
      domain: 'instance-a.example.com',
      actorUri: 'https://instance-a.example.com/users/alice',
      oauthEndpoint: 'https://instance-a.example.com/api/auth/oauth2/authorize',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => webfingerResponse,
    });

    const discovery = await discoverOAuthEndpoint(
      'instance-a.example.com',
      'alice',
      mockFetch,
    );
    expect(discovery).not.toBeNull();

    // 2. Instance A validates authorize request
    const authError = validateAuthorizeRequest(
      {
        clientId: registeredClient.clientId,
        redirectUri: registeredClient.redirectUris[0],
        responseType: 'code',
        state: 'state-xyz',
      },
      registeredClient,
    );
    expect(authError).toBeNull();

    // 3. Instance A validates token exchange
    const tokenError = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'valid-auth-code',
        clientId: registeredClient.clientId,
        clientSecret: registeredClient.clientSecret,
        redirectUri: registeredClient.redirectUris[0],
      },
      registeredClient,
    );
    expect(tokenError).toBeNull();

    // 4. Instance B would create a federated account record
    const federatedAccount = {
      userId: 'local-user-id',
      actorUri: 'https://instance-a.example.com/users/alice',
      instanceDomain: 'instance-a.example.com',
      preferredUsername: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      lastSyncedAt: new Date(),
    };

    expect(federatedAccount.actorUri).toBe('https://instance-a.example.com/users/alice');
    expect(federatedAccount.instanceDomain).toBe('instance-a.example.com');
  });
});
