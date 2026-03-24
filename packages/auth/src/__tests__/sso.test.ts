/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { createSSOProviderConfig, discoverOAuthEndpoint, isTrustedInstance } from '../sso';

function createMockConfig(overrides: Record<string, unknown> = {}) {
  return {
    instance: {
      domain: 'instance-a.example.com',
      name: 'Instance A',
      description: 'Test',
    },
    features: {
      communities: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation: false,
      ...overrides,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
      trustedInstances: ['instance-b.example.com'],
    },
  } as any;
}

describe('createSSOProviderConfig', () => {
  it('should return null when federation is disabled', () => {
    const config = createMockConfig({ federation: false });
    expect(createSSOProviderConfig(config)).toBeNull();
  });

  it('should return provider config when federation is enabled', () => {
    const config = createMockConfig({ federation: true });
    const result = createSSOProviderConfig(config);

    expect(result).toEqual({
      issuer: 'https://instance-a.example.com',
      authorizationEndpoint: 'https://instance-a.example.com/api/auth/oauth2/authorize',
      tokenEndpoint: 'https://instance-a.example.com/api/auth/oauth2/token',
    });
  });
});

describe('discoverOAuthEndpoint', () => {
  it('should parse WebFinger response and return OAuth endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subject: 'acct:alice@instance-a.example.com',
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: 'https://instance-a.example.com/users/alice',
          },
          {
            rel: 'oauth_endpoint',
            href: 'https://instance-a.example.com/api/auth/oauth2/authorize',
          },
        ],
      }),
    });

    const result = await discoverOAuthEndpoint('instance-a.example.com', 'alice', mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/.well-known/webfinger?resource='),
      expect.objectContaining({ headers: { Accept: 'application/jrd+json' } }),
    );

    expect(result).toEqual({
      authorizationEndpoint: 'https://instance-a.example.com/api/auth/oauth2/authorize',
      tokenEndpoint: 'https://instance-a.example.com/api/auth/oauth2/token',
      domain: 'instance-a.example.com',
    });
  });

  it('should return null when WebFinger request fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const result = await discoverOAuthEndpoint('unknown.example.com', 'alice', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null when no oauth_endpoint link exists', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subject: 'acct:alice@instance-a.example.com',
        links: [{ rel: 'self', href: 'https://instance-a.example.com/users/alice' }],
      }),
    });

    const result = await discoverOAuthEndpoint('instance-a.example.com', 'alice', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null when fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
    const result = await discoverOAuthEndpoint('instance-a.example.com', 'alice', mockFetch);
    expect(result).toBeNull();
  });
});

describe('isTrustedInstance', () => {
  it('should return false when federation is disabled', () => {
    const config = createMockConfig({ federation: false });
    expect(isTrustedInstance(config, 'instance-b.example.com')).toBe(false);
  });

  it('should return true for trusted instance when federation is enabled', () => {
    const config = createMockConfig({ federation: true });
    expect(isTrustedInstance(config, 'instance-b.example.com')).toBe(true);
  });

  it('should return false for untrusted instance', () => {
    const config = createMockConfig({ federation: true });
    expect(isTrustedInstance(config, 'evil.example.com')).toBe(false);
  });
});
