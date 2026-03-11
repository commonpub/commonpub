import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCommunities,
  getCommunityBySlug,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getMember,
  listMembers,
  changeRole,
  kickMember,
  createPost,
  listPosts,
  deletePost,
  togglePinPost,
  toggleLockPost,
  createReply,
  listReplies,
  deleteReply,
  banUser,
  unbanUser,
  checkBan,
  listBans,
  createInvite,
  validateAndUseInvite,
  revokeInvite,
  listInvites,
  shareContent,
  unshareContent,
  listShares,
} from '../lib/server/community';

// Reusable mock DB factory
function createMockDb() {
  const chainable = (resolveData: unknown = []) => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.then = vi.fn().mockImplementation((resolve) => resolve(resolveData));
    return chain;
  };

  const db: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnValue(chainable()),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ communityId: 'comm-1', userId: 'user-1', role: 'member' }]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
          then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => resolve({ rowCount: 1 })),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
    transaction: vi.fn(),
  };
  // transaction passes the db itself as the tx argument
  db.transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));

  return db;
}

type MockDB = ReturnType<typeof createMockDb>;
type AnyDB = Parameters<typeof listCommunities>[0];

describe('Community Service', () => {
  describe('listCommunities', () => {
    it('should return empty list when no communities', async () => {
      const db = createMockDb();
      const mainChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };
      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mainChain : countChain;
      });

      const result = await listCommunities(db as unknown as AnyDB, {});
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should apply pagination', async () => {
      const db = createMockDb();
      let capturedLimit: number | undefined;
      let capturedOffset: number | undefined;

      const mainChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((l: number) => {
          capturedLimit = l;
          return mainChain;
        }),
        offset: vi.fn().mockImplementation((o: number) => {
          capturedOffset = o;
          return mainChain;
        }),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };
      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mainChain : countChain;
      });

      await listCommunities(db as unknown as AnyDB, { limit: 10, offset: 5 });
      expect(capturedLimit).toBe(10);
      expect(capturedOffset).toBe(5);
    });

    it('should apply joinPolicy filter', async () => {
      const db = createMockDb();
      let capturedWhere: unknown;

      const mainChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation((w) => {
          capturedWhere = w;
          return mainChain;
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };
      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mainChain : countChain;
      });

      await listCommunities(db as unknown as AnyDB, { joinPolicy: 'open' });
      expect(capturedWhere).toBeDefined();
    });
  });

  describe('getCommunityBySlug', () => {
    it('should return null when not found', async () => {
      const db = createMockDb();
      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(chain);

      const result = await getCommunityBySlug(db as unknown as AnyDB, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return community with currentUserRole when requester is member', async () => {
      const db = createMockDb();
      const mockCommunity = {
        id: 'comm-1',
        name: 'Test',
        slug: 'test',
        description: null,
        iconUrl: null,
        bannerUrl: null,
        joinPolicy: 'open',
        isOfficial: false,
        memberCount: 1,
        postCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user-1',
        rules: null,
      };

      // First call: community lookup
      const communityChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              community: mockCommunity,
              createdBy: { id: 'user-1', username: 'creator', displayName: null, avatarUrl: null },
            },
          ]),
        ),
      };
      // Member check
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'admin' }])),
      };
      // Ban check
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return communityChain;
        if (callCount === 2) return memberChain;
        return banChain;
      });

      const result = await getCommunityBySlug(db as unknown as AnyDB, 'test', 'user-1');
      expect(result).not.toBeNull();
      expect(result!.currentUserRole).toBe('admin');
      expect(result!.isBanned).toBe(false);
    });
  });

  describe('createCommunity', () => {
    it('should create community and add creator as owner', async () => {
      const db = createMockDb();
      const createdCommunity = {
        id: 'comm-1',
        name: 'Test Community',
        slug: 'test-community',
        description: null,
        rules: null,
        joinPolicy: 'open',
        createdById: 'user-1',
        isOfficial: false,
        memberCount: 1,
        postCount: 0,
        iconUrl: null,
        bannerUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // ensureUniqueCommunitySlug
      const slugChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      // getCommunityBySlug after create
      const communityChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              community: createdCommunity,
              createdBy: { id: 'user-1', username: 'creator', displayName: null, avatarUrl: null },
            },
          ]),
        ),
      };

      // Member check
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'owner' }])),
      };

      // Ban check
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return slugChain;
        if (selectCount === 2) return communityChain;
        if (selectCount === 3) return memberChain;
        return banChain;
      });

      db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdCommunity]),
        }),
      });

      const result = await createCommunity(db as unknown as AnyDB, 'user-1', {
        name: 'Test Community',
      });

      expect(result.name).toBe('Test Community');
      expect(result.currentUserRole).toBe('owner');
      expect(db.insert).toHaveBeenCalledTimes(2); // community + member
    });
  });

  describe('deleteCommunity', () => {
    it('should allow owner to delete', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'owner' }])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      const result = await deleteCommunity(db as unknown as AnyDB, 'comm-1', 'user-1');
      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should reject non-owner delete', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'admin' }])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      const result = await deleteCommunity(db as unknown as AnyDB, 'comm-1', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('joinCommunity', () => {
    it('should allow joining open community', async () => {
      const db = createMockDb();
      // Ban check
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => resolve([])),
      };
      // Community lookup
      const communityChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => resolve([{ joinPolicy: 'open' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return banChain;
        return communityChain;
      });

      db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ communityId: 'comm-1', userId: 'user-1', role: 'member' }]),
          }),
        }),
      });

      const result = await joinCommunity(db as unknown as AnyDB, 'user-1', 'comm-1');
      expect(result.joined).toBe(true);
    });

    it('should reject banned users', async () => {
      const db = createMockDb();
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              id: 'ban-1',
              reason: 'spam',
              expiresAt: null,
            },
          ]),
        ),
      };
      db.select = vi.fn().mockReturnValue(banChain);

      const result = await joinCommunity(db as unknown as AnyDB, 'user-1', 'comm-1');
      expect(result.joined).toBe(false);
      expect(result.error).toContain('banned');
    });

    it('should require token for invite communities', async () => {
      const db = createMockDb();
      // Ban check
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => resolve([])),
      };
      // Community lookup
      const communityChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => resolve([{ joinPolicy: 'invite' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return banChain;
        return communityChain;
      });

      const result = await joinCommunity(db as unknown as AnyDB, 'user-1', 'comm-1');
      expect(result.joined).toBe(false);
      expect(result.error).toContain('token');
    });
  });

  describe('leaveCommunity', () => {
    it('should prevent owner from leaving', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'owner' }])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      const result = await leaveCommunity(db as unknown as AnyDB, 'user-1', 'comm-1');
      expect(result.left).toBe(false);
      expect(result.error).toContain('Owner');
    });

    it('should allow member to leave', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      const result = await leaveCommunity(db as unknown as AnyDB, 'user-1', 'comm-1');
      expect(result.left).toBe(true);
    });
  });

  describe('changeRole', () => {
    it('should allow admin to promote member to moderator', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'admin' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await changeRole(
        db as unknown as AnyDB,
        'admin-1',
        'comm-1',
        'user-1',
        'moderator',
      );
      expect(result.changed).toBe(true);
    });

    it('should reject member promoting to admin', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await changeRole(
        db as unknown as AnyDB,
        'user-1',
        'comm-1',
        'user-2',
        'admin',
      );
      expect(result.changed).toBe(false);
    });

    it('should reject promotion to owner', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'owner' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'admin' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await changeRole(
        db as unknown as AnyDB,
        'owner-1',
        'comm-1',
        'admin-1',
        'owner',
      );
      expect(result.changed).toBe(false);
      expect(result.error).toContain('owner');
    });
  });

  describe('kickMember', () => {
    it('should allow admin to kick member', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'admin' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await kickMember(db as unknown as AnyDB, 'admin-1', 'comm-1', 'user-1');
      expect(result.kicked).toBe(true);
    });

    it('should reject member kicking another member', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await kickMember(db as unknown as AnyDB, 'user-1', 'comm-1', 'user-2');
      expect(result.kicked).toBe(false);
    });
  });

  describe('createPost', () => {
    it('should require membership to post', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      await expect(
        createPost(db as unknown as AnyDB, 'user-1', {
          communityId: 'comm-1',
          content: 'Hello',
        }),
      ).rejects.toThrow('Must be a member');
    });

    it('should create post and increment count', async () => {
      const db = createMockDb();
      const mockPost = {
        id: 'post-1',
        communityId: 'comm-1',
        authorId: 'user-1',
        type: 'text',
        content: 'Hello',
        isPinned: false,
        isLocked: false,
        likeCount: 0,
        replyCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };
      const authorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              id: 'user-1',
              username: 'user1',
              displayName: null,
              avatarUrl: null,
            },
          ]),
        ),
      };

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        return selectCount === 1 ? memberChain : authorChain;
      });
      db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPost]),
        }),
      });

      const result = await createPost(db as unknown as AnyDB, 'user-1', {
        communityId: 'comm-1',
        content: 'Hello',
      });

      expect(result.id).toBe('post-1');
      expect(result.content).toBe('Hello');
      expect(db.update).toHaveBeenCalled(); // post count increment
    });
  });

  describe('togglePinPost', () => {
    it('should allow moderator to pin', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'moderator' }])),
      };
      const postChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ isPinned: false }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? memberChain : postChain;
      });

      const result = await togglePinPost(db as unknown as AnyDB, 'post-1', 'mod-1', 'comm-1');
      expect(result).not.toBeNull();
      expect(result!.pinned).toBe(true);
    });

    it('should reject member from pinning', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      const result = await togglePinPost(db as unknown as AnyDB, 'post-1', 'user-1', 'comm-1');
      expect(result).toBeNull();
    });
  });

  describe('createReply', () => {
    it('should reject reply to locked post', async () => {
      const db = createMockDb();
      const postChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              communityId: 'comm-1',
              isLocked: true,
            },
          ]),
        ),
      };
      db.select = vi.fn().mockReturnValue(postChain);

      await expect(
        createReply(db as unknown as AnyDB, 'user-1', {
          postId: 'post-1',
          content: 'Reply',
        }),
      ).rejects.toThrow('locked');
    });
  });

  describe('banUser', () => {
    it('should allow admin to ban member', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'admin' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await banUser(db as unknown as AnyDB, 'admin-1', 'comm-1', 'user-1', 'spam');
      expect(result.banned).toBe(true);
    });

    it('should require expiry for moderator bans', async () => {
      const db = createMockDb();
      const actorChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'moderator' }])),
      };
      const targetChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? actorChain : targetChain;
      });

      const result = await banUser(db as unknown as AnyDB, 'mod-1', 'comm-1', 'user-1');
      expect(result.banned).toBe(false);
      expect(result.error).toContain('temporary');
    });
  });

  describe('checkBan', () => {
    it('should return null for expired bans', async () => {
      const db = createMockDb();
      const expired = new Date(Date.now() - 86400000); // yesterday
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              id: 'ban-1',
              reason: 'spam',
              expiresAt: expired,
            },
          ]),
        ),
      };
      db.select = vi.fn().mockReturnValue(banChain);

      const result = await checkBan(db as unknown as AnyDB, 'comm-1', 'user-1');
      expect(result).toBeNull();
    });

    it('should return ban for active permanent bans', async () => {
      const db = createMockDb();
      const banChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              id: 'ban-1',
              reason: 'spam',
              expiresAt: null,
            },
          ]),
        ),
      };
      db.select = vi.fn().mockReturnValue(banChain);

      const result = await checkBan(db as unknown as AnyDB, 'comm-1', 'user-1');
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('spam');
    });
  });

  describe('validateAndUseInvite', () => {
    it('should reject expired tokens', async () => {
      const db = createMockDb();
      // Atomic UPDATE returns empty array (no matching rows — expired)
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await validateAndUseInvite(db as unknown as AnyDB, 'abc');
      expect(result.valid).toBe(false);
    });

    it('should reject maxed-out tokens', async () => {
      const db = createMockDb();
      // Atomic UPDATE returns empty array (no matching rows — maxed out)
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await validateAndUseInvite(db as unknown as AnyDB, 'abc');
      expect(result.valid).toBe(false);
    });

    it('should accept valid token and increment use count', async () => {
      const db = createMockDb();
      // Atomic UPDATE returns the row (valid invite)
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ communityId: 'comm-1' }]),
          }),
        }),
      });

      const result = await validateAndUseInvite(db as unknown as AnyDB, 'abc');
      expect(result.valid).toBe(true);
      expect(result.communityId).toBe('comm-1');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('shareContent', () => {
    it('should require membership', async () => {
      const db = createMockDb();
      const memberChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(memberChain);

      const result = await shareContent(db as unknown as AnyDB, 'user-1', 'comm-1', 'content-1');
      expect(result).toBeNull();
    });
  });
});
