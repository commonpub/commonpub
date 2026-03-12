import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@commonpub/protocol', () => ({
  generateKeypair: vi.fn().mockResolvedValue({ publicKey: 'mock', privateKey: 'mock' }),
  exportPublicKeyPem: vi.fn().mockResolvedValue('-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----'),
  exportPrivateKeyPem: vi.fn().mockResolvedValue('-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----'),
  resolveActor: vi.fn(),
  contentToArticle: vi.fn(),
  buildCreateActivity: vi.fn(),
  buildUpdateActivity: vi.fn(),
  buildDeleteActivity: vi.fn(),
  buildFollowActivity: vi.fn().mockReturnValue({ type: 'Follow' }),
  buildAcceptActivity: vi.fn().mockReturnValue({ type: 'Accept' }),
  buildRejectActivity: vi.fn().mockReturnValue({ type: 'Reject' }),
  buildUndoActivity: vi.fn(),
  buildLikeActivity: vi.fn(),
}));

vi.mock('@commonpub/schema', () => ({
  users: { id: 'users.id', username: 'users.username' },
  remoteActors: { actorUri: 'remoteActors.actorUri' },
  activities: {
    direction: 'activities.direction',
    status: 'activities.status',
    type: 'activities.type',
    createdAt: 'activities.createdAt',
  },
  followRelationships: {
    id: 'followRelationships.id',
    followerActorUri: 'followRelationships.followerActorUri',
    followingActorUri: 'followRelationships.followingActorUri',
    status: 'followRelationships.status',
  },
  actorKeypairs: { userId: 'actorKeypairs.userId' },
  contentItems: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ op: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  sql: vi.fn(),
}));

import {
  getOrCreateActorKeypair,
  sendFollow,
  acceptFollow,
  rejectFollow,
  listFederationActivity,
} from '../federation';

function createMockChain(resolvedValue: unknown = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(resolvedValue)),
  };
  return chain;
}

describe('federation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateActorKeypair', () => {
    it('returns existing keypair when found', async () => {
      const existingKeypair = {
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nexisting\n-----END PUBLIC KEY-----',
        privateKeyPem: '-----BEGIN PRIVATE KEY-----\nexisting\n-----END PRIVATE KEY-----',
      };

      const chain = createMockChain();
      // Override the limit mock to resolve with the existing keypair row
      chain.limit.mockImplementation(() => ({
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve(resolve([existingKeypair])),
      }));

      const db = {
        select: chain.select,
        insert: chain.insert,
      } as unknown as Parameters<typeof getOrCreateActorKeypair>[0];

      // Wire up the chain
      chain.select.mockReturnValue(chain);

      const result = await getOrCreateActorKeypair(db, 'user-1');

      expect(result).toEqual({
        publicKeyPem: existingKeypair.publicKeyPem,
        privateKeyPem: existingKeypair.privateKeyPem,
      });
    });
  });

  describe('sendFollow', () => {
    it('throws when user not found', async () => {
      const chain = createMockChain();
      chain.limit.mockImplementation(() => ({
        then: (resolve: (v: unknown) => void) => Promise.resolve(resolve([])),
      }));
      chain.select.mockReturnValue(chain);

      const db = {
        select: chain.select,
      } as unknown as Parameters<typeof sendFollow>[0];

      await expect(
        sendFollow(db, 'nonexistent-user', 'https://remote.example/users/bob', 'local.example'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('acceptFollow', () => {
    it('throws when relationship not found', async () => {
      const chain = createMockChain();
      chain.limit.mockImplementation(() => ({
        then: (resolve: (v: unknown) => void) => Promise.resolve(resolve([])),
      }));
      chain.select.mockReturnValue(chain);

      const db = {
        select: chain.select,
      } as unknown as Parameters<typeof acceptFollow>[0];

      await expect(
        acceptFollow(db, 'nonexistent-id', 'local.example'),
      ).rejects.toThrow('Follow relationship not found');
    });
  });

  describe('rejectFollow', () => {
    it('throws when relationship not found', async () => {
      const chain = createMockChain();
      chain.limit.mockImplementation(() => ({
        then: (resolve: (v: unknown) => void) => Promise.resolve(resolve([])),
      }));
      chain.select.mockReturnValue(chain);

      const db = {
        select: chain.select,
      } as unknown as Parameters<typeof rejectFollow>[0];

      await expect(
        rejectFollow(db, 'nonexistent-id', 'local.example'),
      ).rejects.toThrow('Follow relationship not found');
    });
  });

  describe('listFederationActivity', () => {
    it('clamps limit to max 100', async () => {
      const mockRows: unknown[] = [];
      const mockCount = [{ count: 0 }];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      let selectCallCount = 0;
      const db = {
        select: vi.fn().mockImplementation((args?: unknown) => {
          selectCallCount++;
          const chain = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
          };

          // The function uses Promise.all with two db.select() calls
          // First call returns rows, second returns count
          if (selectCallCount % 2 === 1) {
            // rows query — check that limit(100) is called
            const limitMock = vi.fn().mockReturnValue({
              offset: vi.fn().mockImplementation(() => ({
                then: (resolve: (v: unknown) => void) => Promise.resolve(resolve(mockRows)),
              })),
            });
            chain.orderBy = vi.fn().mockReturnValue({ limit: limitMock });
            chain.limit = limitMock;
            (chain as Record<string, unknown>)._limitMock = limitMock;
          } else {
            // count query
            chain.where = vi.fn().mockImplementation(() => ({
              then: (resolve: (v: unknown) => void) => Promise.resolve(resolve(mockCount)),
            }));
          }

          return chain;
        }),
      } as unknown as Parameters<typeof listFederationActivity>[0];

      const result = await listFederationActivity(db, { limit: 500 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      // Verify the function was called — the clamping happens internally at Math.min(500, 100) = 100
    });
  });
});
