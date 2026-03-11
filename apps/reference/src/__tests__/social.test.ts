import { describe, it, expect, vi } from 'vitest';
import {
  toggleLike,
  isLiked,
  listComments,
  createComment,
  deleteComment,
  toggleBookmark,
} from '../lib/server/social';

function createMockDb() {
  const db: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  // transaction passes the db itself as the tx argument
  db.transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return db;
}

function mockChain(result: unknown = []) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]);
  chain.then = vi
    .fn()
    .mockImplementation((resolve) => resolve(Array.isArray(result) ? result : [result]));
  return chain;
}

describe('Social Service', () => {
  describe('toggleLike', () => {
    it('should add a like when not already liked', async () => {
      const db = createMockDb();
      // Check existing: none found
      db.select.mockReturnValue(mockChain([]));
      // Insert
      db.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      // Update content count
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const result = await toggleLike(
        db as unknown as Parameters<typeof toggleLike>[0],
        'user-1',
        'project',
        'content-1',
      );

      expect(result.liked).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should remove a like when already liked', async () => {
      const db = createMockDb();
      // Check existing: found
      db.select.mockReturnValue(mockChain([{ id: 'like-1' }]));
      // Delete
      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });
      // Update content count
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const result = await toggleLike(
        db as unknown as Parameters<typeof toggleLike>[0],
        'user-1',
        'project',
        'content-1',
      );

      expect(result.liked).toBe(false);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('isLiked', () => {
    it('should return true when liked', async () => {
      const db = createMockDb();
      db.select.mockReturnValue(mockChain([{ id: 'like-1' }]));

      const result = await isLiked(
        db as unknown as Parameters<typeof isLiked>[0],
        'user-1',
        'project',
        'content-1',
      );

      expect(result).toBe(true);
    });

    it('should return false when not liked', async () => {
      const db = createMockDb();
      db.select.mockReturnValue(mockChain([]));

      const result = await isLiked(
        db as unknown as Parameters<typeof isLiked>[0],
        'user-1',
        'project',
        'content-1',
      );

      expect(result).toBe(false);
    });
  });

  describe('listComments', () => {
    it('should return empty array when no comments', async () => {
      const db = createMockDb();
      db.select.mockReturnValue(mockChain([]));

      const result = await listComments(
        db as unknown as Parameters<typeof listComments>[0],
        'project',
        'content-1',
      );

      expect(result).toEqual([]);
    });

    it('should build threaded structure', async () => {
      const db = createMockDb();
      const mockComments = [
        {
          comment: {
            id: 'c1',
            content: 'Root comment',
            likeCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            parentId: null,
          },
          author: { id: 'u1', username: 'user1', displayName: 'User 1', avatarUrl: null },
        },
        {
          comment: {
            id: 'c2',
            content: 'Reply',
            likeCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            parentId: 'c1',
          },
          author: { id: 'u2', username: 'user2', displayName: 'User 2', avatarUrl: null },
        },
      ];
      db.select.mockReturnValue(mockChain(mockComments));

      const result = await listComments(
        db as unknown as Parameters<typeof listComments>[0],
        'project',
        'content-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('c1');
      expect(result[0]!.replies).toHaveLength(1);
      expect(result[0]!.replies![0]!.id).toBe('c2');
    });
  });

  describe('createComment', () => {
    it('should insert comment and update count', async () => {
      const db = createMockDb();
      const newComment = {
        id: 'c-new',
        content: 'Test comment',
        likeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        authorId: 'user-1',
        targetType: 'project',
        targetId: 'content-1',
      };

      // Insert
      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newComment]),
        }),
      });
      // Update count
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });
      // Get author
      db.select.mockReturnValue(
        mockChain([{ id: 'user-1', username: 'user1', displayName: 'User 1', avatarUrl: null }]),
      );

      const result = await createComment(
        db as unknown as Parameters<typeof createComment>[0],
        'user-1',
        { targetType: 'project', targetId: 'content-1', content: 'Test comment' },
      );

      expect(result.id).toBe('c-new');
      expect(result.content).toBe('Test comment');
      expect(result.author.username).toBe('user1');
    });
  });

  describe('deleteComment', () => {
    it('should delete comment when owned by user', async () => {
      const db = createMockDb();
      // Check ownership
      db.select.mockReturnValue(mockChain([{ id: 'c1', targetId: 'content-1', targetType: 'project' }]));
      // Delete
      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });
      // Update count
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const result = await deleteComment(
        db as unknown as Parameters<typeof deleteComment>[0],
        'c1',
        'user-1',
      );

      expect(result).toBe(true);
    });

    it('should return false when not owned', async () => {
      const db = createMockDb();
      db.select.mockReturnValue(mockChain([]));

      const result = await deleteComment(
        db as unknown as Parameters<typeof deleteComment>[0],
        'c1',
        'wrong-user',
      );

      expect(result).toBe(false);
    });
  });

  describe('toggleBookmark', () => {
    it('should add bookmark when not bookmarked', async () => {
      const db = createMockDb();
      db.select.mockReturnValue(mockChain([]));
      db.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

      const result = await toggleBookmark(
        db as unknown as Parameters<typeof toggleBookmark>[0],
        'user-1',
        'project',
        'content-1',
      );

      expect(result.bookmarked).toBe(true);
    });

    it('should remove bookmark when already bookmarked', async () => {
      const db = createMockDb();
      db.select.mockReturnValue(mockChain([{ id: 'bm-1' }]));
      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });

      const result = await toggleBookmark(
        db as unknown as Parameters<typeof toggleBookmark>[0],
        'user-1',
        'project',
        'content-1',
      );

      expect(result.bookmarked).toBe(false);
    });
  });
});
