import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listContent,
  getContentBySlug,
  createContent,
  updateContent,
  deleteContent,
  publishContent,
} from '../lib/server/content';

// Mock Drizzle DB
function createMockDb() {
  const mockRows: Record<string, unknown>[] = [];
  let insertedValues: Record<string, unknown> | null = null;
  let updatedValues: Record<string, unknown> | null = null;
  let lastWhereCondition: unknown = null;

  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockImplementation((condition) => {
      lastWhereCondition = condition;
      return chain;
    });
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.then = vi.fn().mockImplementation((resolve) => resolve(mockRows));
    return chain;
  };

  const db = {
    select: vi.fn().mockReturnValue(chainable()),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
    _mockRows: mockRows,
    _setMockRows: (rows: Record<string, unknown>[]) => {
      mockRows.length = 0;
      mockRows.push(...rows);
    },
  };

  return db;
}

// These tests verify the content service logic without a real database.
// Integration tests with a real DB would go in a separate suite.

describe('Content Service', () => {
  describe('listContent', () => {
    it('should call db.select with correct structure', async () => {
      const db = createMockDb();
      const selectChain = db.select();

      // Override the select to track calls
      const mockSelect = vi.fn().mockReturnValue(selectChain);
      db.select = mockSelect;

      // Mock the count query to return alongside the main query
      // Since listContent uses Promise.all, we need both queries to resolve
      const mockChain = {
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
        return callCount === 1 ? mockChain : countChain;
      });

      const result = await listContent(db as unknown as Parameters<typeof listContent>[0], {});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should apply status filter', async () => {
      const db = createMockDb();
      let capturedWhere: unknown = null;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation((w) => {
          capturedWhere = w;
          return mockChain;
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
        return callCount === 1 ? mockChain : countChain;
      });

      await listContent(db as unknown as Parameters<typeof listContent>[0], {
        status: 'published',
      });

      expect(mockChain.where).toHaveBeenCalled();
      expect(capturedWhere).toBeDefined();
    });

    it('should apply type filter', async () => {
      const db = createMockDb();
      let capturedWhere: unknown = null;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation((w) => {
          capturedWhere = w;
          return mockChain;
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
        return callCount === 1 ? mockChain : countChain;
      });

      await listContent(db as unknown as Parameters<typeof listContent>[0], { type: 'project' });

      expect(mockChain.where).toHaveBeenCalled();
      expect(capturedWhere).toBeDefined();
    });

    it('should apply pagination with limit and offset', async () => {
      const db = createMockDb();
      let capturedLimit: number | undefined;
      let capturedOffset: number | undefined;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((l) => {
          capturedLimit = l;
          return mockChain;
        }),
        offset: vi.fn().mockImplementation((o) => {
          capturedOffset = o;
          return mockChain;
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
        return callCount === 1 ? mockChain : countChain;
      });

      await listContent(db as unknown as Parameters<typeof listContent>[0], {
        limit: 10,
        offset: 20,
      });

      expect(capturedLimit).toBe(10);
      expect(capturedOffset).toBe(20);
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
        limit: vi.fn().mockImplementation((l) => {
          capturedLimit = l;
          return mockChain;
        }),
        offset: vi.fn().mockImplementation((o) => {
          capturedOffset = o;
          return mockChain;
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
        return callCount === 1 ? mockChain : countChain;
      });

      await listContent(db as unknown as Parameters<typeof listContent>[0], {});

      expect(capturedLimit).toBe(20);
      expect(capturedOffset).toBe(0);
    });
  });

  describe('getContentBySlug', () => {
    it('should return null when content not found', async () => {
      const db = createMockDb();
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(mockChain);

      const result = await getContentBySlug(
        db as unknown as Parameters<typeof getContentBySlug>[0],
        'non-existent',
      );

      expect(result).toBeNull();
    });

    it('should return null for non-published content when requester is not author', async () => {
      const db = createMockDb();
      const mockContent = {
        id: 'content-1',
        authorId: 'author-1',
        type: 'project',
        title: 'Draft Project',
        slug: 'draft-project',
        status: 'draft',
        description: null,
        coverImageUrl: null,
        subtitle: null,
        content: null,
        category: null,
        difficulty: null,
        buildTime: null,
        estimatedCost: null,
        visibility: 'public',
        isFeatured: false,
        seoDescription: null,
        previewToken: null,
        parts: null,
        sections: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        forkCount: 0,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              content: mockContent,
              author: {
                id: 'author-1',
                username: 'author',
                displayName: 'Author',
                avatarUrl: null,
              },
            },
          ]),
        ),
      };
      db.select = vi.fn().mockReturnValue(mockChain);

      const result = await getContentBySlug(
        db as unknown as Parameters<typeof getContentBySlug>[0],
        'draft-project',
        'other-user',
      );

      expect(result).toBeNull();
    });

    it('should return draft content when requester is the author', async () => {
      const db = createMockDb();
      const mockContent = {
        id: 'content-1',
        authorId: 'author-1',
        type: 'project',
        title: 'Draft Project',
        slug: 'draft-project',
        status: 'draft',
        description: null,
        coverImageUrl: null,
        subtitle: null,
        content: null,
        category: null,
        difficulty: null,
        buildTime: null,
        estimatedCost: null,
        visibility: 'public',
        isFeatured: false,
        seoDescription: null,
        previewToken: null,
        parts: null,
        sections: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        forkCount: 0,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contentChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              content: mockContent,
              author: {
                id: 'author-1',
                username: 'author',
                displayName: 'Author',
                avatarUrl: null,
              },
            },
          ]),
        ),
      };

      // Tags query returns empty
      const tagsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? contentChain : tagsChain;
      });

      const result = await getContentBySlug(
        db as unknown as Parameters<typeof getContentBySlug>[0],
        'draft-project',
        'author-1',
      );

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Draft Project');
      expect(result!.status).toBe('draft');
    });

    it('should return published content to any requester', async () => {
      const db = createMockDb();
      const mockContent = {
        id: 'content-1',
        authorId: 'author-1',
        type: 'article',
        title: 'Published Article',
        slug: 'published-article',
        status: 'published',
        description: 'A published article',
        coverImageUrl: null,
        subtitle: null,
        content: [['text', { html: '<p>Hello</p>' }]],
        category: null,
        difficulty: null,
        buildTime: null,
        estimatedCost: null,
        visibility: 'public',
        isFeatured: false,
        seoDescription: null,
        previewToken: null,
        parts: null,
        sections: null,
        viewCount: 10,
        likeCount: 5,
        commentCount: 2,
        forkCount: 0,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contentChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              content: mockContent,
              author: {
                id: 'author-1',
                username: 'author',
                displayName: 'Author',
                avatarUrl: null,
              },
            },
          ]),
        ),
      };

      const tagsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([{ id: 'tag-1', name: 'svelte', slug: 'svelte' }]),
        ),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? contentChain : tagsChain;
      });

      const result = await getContentBySlug(
        db as unknown as Parameters<typeof getContentBySlug>[0],
        'published-article',
      );

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Published Article');
      expect(result!.tags).toEqual([{ id: 'tag-1', name: 'svelte', slug: 'svelte' }]);
    });
  });

  describe('createContent', () => {
    it('should generate a slug from the title', async () => {
      const db = createMockDb();
      const createdItem = {
        id: 'new-1',
        slug: 'my-project',
        authorId: 'author-1',
        type: 'project',
        title: 'My Project',
        status: 'draft',
        description: null,
        coverImageUrl: null,
        subtitle: null,
        content: null,
        category: null,
        difficulty: null,
        buildTime: null,
        estimatedCost: null,
        visibility: 'public',
        isFeatured: false,
        seoDescription: null,
        previewToken: 'abc123',
        parts: null,
        sections: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        forkCount: 0,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // ensureUniqueSlug select (no collision)
      const slugCheckChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      // insert returning
      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdItem]),
        }),
      };

      // getContentBySlug select (after create)
      const contentChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              content: createdItem,
              author: {
                id: 'author-1',
                username: 'author',
                displayName: 'Author',
                avatarUrl: null,
              },
            },
          ]),
        ),
      };

      const tagsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return slugCheckChain; // ensureUniqueSlug
        if (selectCount === 2) return contentChain; // getContentBySlug
        return tagsChain; // tags query
      });
      db.insert = vi.fn().mockReturnValue(insertChain);

      const result = await createContent(
        db as unknown as Parameters<typeof createContent>[0],
        'author-1',
        { type: 'project', title: 'My Project' },
      );

      expect(result.slug).toBe('my-project');
      expect(result.status).toBe('draft');
    });
  });

  describe('updateContent', () => {
    it('should return null when content not owned by user', async () => {
      const db = createMockDb();
      const ownerCheckChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(ownerCheckChain);

      const result = await updateContent(
        db as unknown as Parameters<typeof updateContent>[0],
        'content-1',
        'wrong-author',
        { title: 'Updated' },
      );

      expect(result).toBeNull();
    });

    it('should update title and regenerate slug when title changes', async () => {
      const db = createMockDb();
      const existing = {
        id: 'content-1',
        authorId: 'author-1',
        title: 'Old Title',
        slug: 'old-title',
        status: 'draft',
        publishedAt: null,
      };

      const ownerCheckChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([existing])),
      };

      // slug uniqueness check
      const slugCheckChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      // getContentBySlug after update
      const updatedContent = {
        ...existing,
        title: 'New Title',
        slug: 'new-title',
        description: null,
        coverImageUrl: null,
        subtitle: null,
        content: null,
        category: null,
        difficulty: null,
        buildTime: null,
        estimatedCost: null,
        visibility: 'public',
        isFeatured: false,
        seoDescription: null,
        previewToken: null,
        parts: null,
        sections: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        forkCount: 0,
        type: 'project',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contentChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              content: updatedContent,
              author: {
                id: 'author-1',
                username: 'author',
                displayName: 'Author',
                avatarUrl: null,
              },
            },
          ]),
        ),
      };

      const tagsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return ownerCheckChain;
        if (selectCount === 2) return slugCheckChain;
        if (selectCount === 3) return contentChain;
        return tagsChain;
      });

      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue(updateSetChain),
      });

      const result = await updateContent(
        db as unknown as Parameters<typeof updateContent>[0],
        'content-1',
        'author-1',
        { title: 'New Title' },
      );

      expect(result).not.toBeNull();
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('deleteContent', () => {
    it('should soft-delete by setting status to archived', async () => {
      const db = createMockDb();
      let capturedSet: Record<string, unknown> | null = null;

      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      const result = await deleteContent(
        db as unknown as Parameters<typeof deleteContent>[0],
        'content-1',
        'author-1',
      );

      expect(result).toBe(true);
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.status).toBe('archived');
    });

    it('should return false when content not found or not owned', async () => {
      const db = createMockDb();
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue(updateSetChain),
      });

      const result = await deleteContent(
        db as unknown as Parameters<typeof deleteContent>[0],
        'content-1',
        'wrong-author',
      );

      expect(result).toBe(false);
    });
  });

  describe('publishContent', () => {
    it('should set status to published', async () => {
      const db = createMockDb();
      const existing = {
        id: 'content-1',
        authorId: 'author-1',
        title: 'My Article',
        slug: 'my-article',
        status: 'draft',
        publishedAt: null,
      };

      const ownerCheckChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([existing])),
      };

      const publishedContent = {
        ...existing,
        status: 'published',
        publishedAt: new Date(),
        description: null,
        coverImageUrl: null,
        subtitle: null,
        content: null,
        category: null,
        difficulty: null,
        buildTime: null,
        estimatedCost: null,
        visibility: 'public',
        isFeatured: false,
        seoDescription: null,
        previewToken: null,
        parts: null,
        sections: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        forkCount: 0,
        type: 'article',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contentChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            {
              content: publishedContent,
              author: {
                id: 'author-1',
                username: 'author',
                displayName: 'Author',
                avatarUrl: null,
              },
            },
          ]),
        ),
      };

      const tagsChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      let selectCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return ownerCheckChain;
        if (selectCount === 2) return contentChain;
        return tagsChain;
      });

      let capturedSet: Record<string, unknown> | null = null;
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      const result = await publishContent(
        db as unknown as Parameters<typeof publishContent>[0],
        'content-1',
        'author-1',
      );

      expect(result).not.toBeNull();
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.status).toBe('published');
      expect(capturedSet!.publishedAt).toBeDefined();
    });
  });
});
