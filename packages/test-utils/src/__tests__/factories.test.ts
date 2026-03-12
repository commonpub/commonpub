import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestUser,
  createTestSession,
  createTestFederatedAccount,
  createTestOAuthClient,
  resetFactoryCounter,
} from '../factories';
import { createTestConfig } from '../mockConfig';

beforeEach(() => {
  resetFactoryCounter();
});

describe('createTestUser', () => {
  it('should create a user with default values', () => {
    const user = createTestUser();
    expect(user.id).toBeDefined();
    expect(user.email).toMatch(/^user\d+@test\.example\.com$/);
    expect(user.username).toMatch(/^testuser\d+$/);
    expect(user.role).toBe('member');
    expect(user.status).toBe('active');
    expect(user.emailVerified).toBe(true);
  });

  it('should accept overrides', () => {
    const user = createTestUser({ role: 'admin', displayName: 'Alice' });
    expect(user.role).toBe('admin');
    expect(user.displayName).toBe('Alice');
  });

  it('should generate unique users', () => {
    const a = createTestUser();
    const b = createTestUser();
    expect(a.id).not.toBe(b.id);
    expect(a.email).not.toBe(b.email);
    expect(a.username).not.toBe(b.username);
  });
});

describe('createTestSession', () => {
  it('should create a session with default values', () => {
    const session = createTestSession();
    expect(session.id).toBeDefined();
    expect(session.userId).toBeDefined();
    expect(session.token).toBeDefined();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should accept overrides', () => {
    const userId = 'custom-user-id';
    const session = createTestSession({ userId });
    expect(session.userId).toBe(userId);
  });
});

describe('createTestFederatedAccount', () => {
  it('should create a federated account with default values', () => {
    const account = createTestFederatedAccount();
    expect(account.actorUri).toMatch(/^https:\/\//);
    expect(account.instanceDomain).toBeDefined();
    expect(account.preferredUsername).toBeDefined();
  });

  it('should use provided instanceDomain in actorUri', () => {
    const account = createTestFederatedAccount({ instanceDomain: 'hack.build' });
    expect(account.instanceDomain).toBe('hack.build');
    expect(account.actorUri).toContain('hack.build');
  });
});

describe('createTestOAuthClient', () => {
  it('should create an oauth client with default values', () => {
    const client = createTestOAuthClient();
    expect(client.clientId).toBeDefined();
    expect(client.clientSecret).toBeDefined();
    expect(client.redirectUris).toHaveLength(1);
    expect(client.redirectUris[0]).toContain('/api/auth/callback/cpub-sso');
  });

  it('should use provided instanceDomain in redirectUri', () => {
    const client = createTestOAuthClient({ instanceDomain: 'other.example.com' });
    expect(client.instanceDomain).toBe('other.example.com');
    expect(client.redirectUris[0]).toContain('other.example.com');
  });
});

describe('createTestConfig', () => {
  it('should create a valid config with defaults', () => {
    const config = createTestConfig();
    expect(config.instance.domain).toBe('test.example.com');
    expect(config.instance.name).toBe('Test Instance');
    expect(config.features.federation).toBe(false);
    expect(config.auth.emailPassword).toBe(true);
  });

  it('should accept feature overrides', () => {
    const config = createTestConfig({ features: { federation: true } as any });
    expect(config.features.federation).toBe(true);
    expect(config.features.communities).toBe(true);
  });

  it('should accept auth overrides', () => {
    const config = createTestConfig({
      auth: { trustedInstances: ['other.example.com'] } as any,
    });
    expect(config.auth.trustedInstances).toEqual(['other.example.com']);
    expect(config.auth.emailPassword).toBe(true);
  });

  it('should accept instance overrides', () => {
    const config = createTestConfig({
      instance: { domain: 'custom.dev' } as any,
    });
    expect(config.instance.domain).toBe('custom.dev');
    expect(config.instance.name).toBe('Test Instance');
  });
});
