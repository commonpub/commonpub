import { describe, it, expect, vi } from 'vitest';
import {
  listPaths,
  getPathBySlug,
  updatePath,
  deletePath,
  enroll,
  unenroll,
} from '../learning';

// Mock Drizzle DB — chainable select/insert/update/delete
function createMockDb() {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return db;
}

function chainable(resolveWith: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.for = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn().mockImplementation((resolve) => resolve(resolveWith));
  return chain;
}

type MockDB = ReturnType<typeof createMockDb>;
type LearningDB = Parameters<typeof listPaths>[0];

function asDb(db: MockDB): LearningDB {
  return db as unknown as LearningDB;
}

// These tests verify the learning service logic without a real database.
// Integration tests with a real DB would go in a separate suite.

describe('Learning Service', () => {
  describe('listPaths', () => {
    it('should clamp limit to max 100', async () => {
      const db = createMockDb();
      let capturedLimit: number | undefined;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((l: number) => {
          capturedLimit = l;
          return mockChain;
        }),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown[]) => void) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi
          .fn()
          .mockImplementation((resolve: (v: unknown[]) => void) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      await listPaths(asDb(db), { limit: 500 });

      expect(capturedLimit).toBe(100);
    });

    it('should default to limit 20 and offset 0', async () => {
      const db = createMockDb();
      let capturedLimit: number | undefined;
      let capturedOffset: number | undefined;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((l: number) => {
          capturedLimit = l;
          return mockChain;
        }),
        offset: vi.fn().mockImplementation((o: number) => {
          capturedOffset = o;
          return mockChain;
        }),
        then: vi.fn().mockImplementation((resolve: (v: unknown[]) => void) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi
          .fn()
          .mockImplementation((resolve: (v: unknown[]) => void) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      await listPaths(asDb(db), {});

      expect(capturedLimit).toBe(20);
      expect(capturedOffset).toBe(0);
    });
  });

  describe('getPathBySlug', () => {
    it('should return null when no rows found', async () => {
      const db = createMockDb();
      db.select = vi.fn().mockReturnValue(chainable([]));

      const result = await getPathBySlug(asDb(db), 'non-existent');

      expect(result).toBeNull();
    });

    it('should return null for non-published path when requester is not the author', async () => {
      const db = createMockDb();
      const mockPath = {
        id: 'path-1',
        authorId: 'author-1',
        title: 'Draft Path',
        slug: 'draft-path',
        description: null,
        coverImageUrl: null,
        difficulty: 'beginner',
        estimatedHours: null,
        enrollmentCount: 0,
        completionCount: 0,
        averageRating: null,
        reviewCount: 0,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pathChain = chainable([
        {
          path: mockPath,
          author: {
            id: 'author-1',
            username: 'author',
            displayName: 'Author',
            avatarUrl: null,
          },
        },
      ]);

      db.select = vi.fn().mockReturnValue(pathChain);

      const result = await getPathBySlug(asDb(db), 'draft-path', 'other-user');

      expect(result).toBeNull();
    });

    it('should return draft path when requester is the author', async () => {
      const db = createMockDb();
      const mockPath = {
        id: 'path-1',
        authorId: 'author-1',
        title: 'Draft Path',
        slug: 'draft-path',
        description: null,
        coverImageUrl: null,
        difficulty: 'beginner',
        estimatedHours: null,
        enrollmentCount: 0,
        completionCount: 0,
        averageRating: null,
        reviewCount: 0,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pathChain = chainable([
        {
          path: mockPath,
          author: {
            id: 'author-1',
            username: 'author',
            displayName: 'Author',
            avatarUrl: null,
          },
        },
      ]);

      // 1: getPathBySlug main query
      // 2: modules query
      // 3: enrollment query
      const modulesChain = chainable([]);
      const enrollmentChain = chainable([]);

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return pathChain;
        if (selectCount === 2) return modulesChain;
        return enrollmentChain;
      });

      const result = await getPathBySlug(asDb(db), 'draft-path', 'author-1');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Draft Path');
      expect(result!.status).toBe('draft');
    });
  });

  describe('updatePath', () => {
    it('should return null when ownership check fails', async () => {
      const db = createMockDb();
      // Ownership select returns empty — wrong author
      db.select = vi.fn().mockReturnValue(chainable([]));

      const result = await updatePath(asDb(db), 'path-1', 'wrong-author', {
        title: 'Updated Title',
      });

      expect(result).toBeNull();
    });
  });

  describe('deletePath', () => {
    it('should return true when path is owned and soft-deleted', async () => {
      const db = createMockDb();
      let capturedSet: Record<string, unknown> | null = null;

      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      const result = await deletePath(asDb(db), 'path-1', 'author-1');

      expect(result).toBe(true);
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.status).toBe('archived');
    });

    it('should return false for non-owned path', async () => {
      const db = createMockDb();
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue(updateSetChain),
      });

      const result = await deletePath(asDb(db), 'path-1', 'wrong-author');

      expect(result).toBe(false);
    });
  });

  describe('enroll', () => {
    it('should throw when path is not found or not published', async () => {
      const db = createMockDb();

      // First select: check existing enrollment — not enrolled
      const enrollmentCheckChain = chainable([]);
      // Second select: check path is published — not found
      const pathCheckChain = chainable([]);

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        return selectCount === 1 ? enrollmentCheckChain : pathCheckChain;
      });

      await expect(enroll(asDb(db), 'user-1', 'nonexistent-path')).rejects.toThrow(
        'Path not found or not published',
      );
    });

    it('should throw when path exists but is in draft status', async () => {
      const db = createMockDb();

      // First select: check existing enrollment — not enrolled
      const enrollmentCheckChain = chainable([]);
      // Second select: check path is published — query uses status='published' filter so draft won't match
      const pathCheckChain = chainable([]);

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        return selectCount === 1 ? enrollmentCheckChain : pathCheckChain;
      });

      await expect(enroll(asDb(db), 'user-1', 'draft-path')).rejects.toThrow(
        'Path not found or not published',
      );
    });

    it('should return existing enrollment when already enrolled (idempotent)', async () => {
      const db = createMockDb();
      const existingEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        pathId: 'path-1',
        progress: '0',
        startedAt: new Date(),
        completedAt: null,
      };

      db.select = vi.fn().mockReturnValue(chainable([existingEnrollment]));

      const result = await enroll(asDb(db), 'user-1', 'path-1');

      expect(result).toEqual(existingEnrollment);
      // insert should NOT have been called
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('unenroll', () => {
    it('should return false when not enrolled', async () => {
      const db = createMockDb();
      db.select = vi.fn().mockReturnValue(chainable([]));

      const result = await unenroll(asDb(db), 'user-1', 'path-1');

      expect(result).toBe(false);
    });

    it('should return true and delete enrollment when enrolled', async () => {
      const db = createMockDb();
      const existingEnrollment = {
        id: 'enrollment-1',
        userId: 'user-1',
        pathId: 'path-1',
        progress: '0',
        startedAt: new Date(),
        completedAt: null,
      };

      db.select = vi.fn().mockReturnValue(chainable([existingEnrollment]));
      db.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });

      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue(updateSetChain),
      });

      const result = await unenroll(asDb(db), 'user-1', 'path-1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
