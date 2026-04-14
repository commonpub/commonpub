import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFederation } from '../federation';

beforeEach(() => {
  vi.clearAllMocks();
});

function createTestConfig(federation = false) {
  return {
    instance: {
      domain: 'test.example.com',
      name: 'Test Instance',
      description: 'A test instance',
    },
    features: {
      communities: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const mockLookupUser = vi.fn();
const mockGetStats = vi.fn();

describe('createFederation', () => {
  it('should return null when federation is disabled', () => {
    const result = createFederation({
      config: createTestConfig(false),
      version: '0.1.0',
      lookupUser: mockLookupUser,
      getStats: mockGetStats,
    });

    expect(result).toBeNull();
  });

  it('should return handlers when federation is enabled', () => {
    const result = createFederation({
      config: createTestConfig(true),
      version: '0.1.0',
      lookupUser: mockLookupUser,
      getStats: mockGetStats,
    });

    expect(result).not.toBeNull();
    expect(result!.handleWebFinger).toBeTypeOf('function');
    expect(result!.handleNodeInfo).toBeTypeOf('function');
    expect(result!.handleNodeInfoWellKnown).toBeTypeOf('function');
  });
});

describe('federation handlers', () => {
  function createHandlers() {
    return createFederation({
      config: createTestConfig(true),
      version: '0.1.0',
      lookupUser: mockLookupUser,
      getStats: mockGetStats,
    })!;
  }

  describe('handleWebFinger', () => {
    it('should return WebFinger response for known user', async () => {
      mockLookupUser.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        actorUri: 'https://test.example.com/users/alice',
      });

      const handlers = createHandlers();
      const result = await handlers.handleWebFinger('acct:alice@test.example.com');

      expect(result).not.toBeNull();
      expect(result!.subject).toBe('acct:alice@test.example.com');
      expect(result!.links).toContainEqual(
        expect.objectContaining({
          rel: 'self',
          href: 'https://test.example.com/users/alice',
        }),
      );
    });

    it('should return null for unknown user', async () => {
      mockLookupUser.mockResolvedValue(null);

      const handlers = createHandlers();
      const result = await handlers.handleWebFinger('acct:nobody@test.example.com');

      expect(result).toBeNull();
    });

    it('should return null for wrong domain', async () => {
      const handlers = createHandlers();
      const result = await handlers.handleWebFinger('acct:alice@other.com');

      expect(result).toBeNull();
      expect(mockLookupUser).not.toHaveBeenCalled();
    });

    it('should return null for invalid resource', async () => {
      const handlers = createHandlers();
      const result = await handlers.handleWebFinger('invalid');

      expect(result).toBeNull();
    });

    it('should include oauth_endpoint in WebFinger links', async () => {
      mockLookupUser.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        actorUri: 'https://test.example.com/users/alice',
      });

      const handlers = createHandlers();
      const result = await handlers.handleWebFinger('acct:alice@test.example.com');

      expect(result!.links).toContainEqual(
        expect.objectContaining({
          rel: 'oauth_endpoint',
          href: 'https://test.example.com/auth/oauth/authorize',
        }),
      );
    });
  });

  describe('handleNodeInfo', () => {
    it('should return NodeInfo 2.1 with stats', async () => {
      mockGetStats.mockResolvedValue({
        userCount: 42,
        activeMonthCount: 10,
        localPostCount: 200,
      });

      const handlers = createHandlers();
      const result = await handlers.handleNodeInfo();

      expect(result.version).toBe('2.1');
      expect(result.software.name).toBe('commonpub');
      expect(result.usage.users.total).toBe(42);
      expect(result.protocols).toContain('activitypub');
    });
  });

  describe('handleNodeInfoWellKnown', () => {
    it('should return well-known link', () => {
      const handlers = createHandlers();
      const result = handlers.handleNodeInfoWellKnown();

      expect(result.links[0].href).toBe('https://test.example.com/nodeinfo/2.1');
    });
  });
});
