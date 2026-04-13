/**
 * Integration tests for the Article→Blog type merge.
 *
 * Blog is the canonical type for all long-form written content.
 * 'article' is accepted for backwards compatibility but normalized to 'blog'
 * at every ingestion point: createContent, federation inbound, AP middleware.
 *
 * These tests verify the normalization contract end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContent,
  listContent,
  getContentBySlug,
  publishContent,
  onContentPublished,
} from '../content/content.js';
import { getUserByUsername } from '../profile/profile.js';
import { contentItems } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';

describe('article→blog type merge', () => {
  let db: DB;
  let userId: string;
  let username: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db);
    userId = user.id;
    username = user.username;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // ─── createContent normalization ───

  describe('createContent normalization', () => {
    it('normalizes type:article to type:blog on create', async () => {
      const result = await createContent(db, userId, {
        type: 'article',
        title: 'Written As Article',
      });

      expect(result.type).toBe('blog');
    });

    it('preserves type:blog as-is', async () => {
      const result = await createContent(db, userId, {
        type: 'blog',
        title: 'Written As Blog',
      });

      expect(result.type).toBe('blog');
    });

    it('does not normalize other types', async () => {
      const project = await createContent(db, userId, {
        type: 'project',
        title: 'Project Type Test',
      });
      expect(project.type).toBe('project');
    });

    it('stores normalized type in database', async () => {
      const result = await createContent(db, userId, {
        type: 'article',
        title: 'DB Type Check',
      });

      // Query DB directly to verify
      const [row] = await db
        .select({ type: contentItems.type })
        .from(contentItems)
        .where(eq(contentItems.id, result.id));

      expect(row!.type).toBe('blog');
    });

    it('generates slug scoped to normalized type', async () => {
      // Create two items with same title — one as 'article', one as 'blog'
      // Both should normalize to 'blog' and get unique slugs
      const a = await createContent(db, userId, {
        type: 'article',
        title: 'Slug Scope Test',
      });
      const b = await createContent(db, userId, {
        type: 'blog',
        title: 'Slug Scope Test',
      });

      // Both are type 'blog', so slugs must differ
      expect(a.type).toBe('blog');
      expect(b.type).toBe('blog');
      expect(a.slug).not.toBe(b.slug);
    });
  });

  // ─── Content retrieval after normalization ───

  describe('content retrieval', () => {
    it('lists article-created content under type:blog filter', async () => {
      const created = await createContent(db, userId, {
        type: 'article',
        title: 'Findable As Blog',
      });
      await publishContent(db, created.id, userId);

      const result = await listContent(db, { type: 'blog', status: 'published' });
      const found = result.items.find((i) => i.id === created.id);
      expect(found).toBeDefined();
      expect(found!.type).toBe('blog');
    });

    it('type:article filter returns nothing after normalization', async () => {
      const result = await listContent(db, { type: 'article', status: 'published' });
      // All article-created content is stored as blog
      expect(result.items.every((i) => i.type !== 'article')).toBe(true);
    });

    it('finds normalized content by slug', async () => {
      const created = await createContent(db, userId, {
        type: 'article',
        title: 'Slug Lookup Test',
      });

      const found = await getContentBySlug(db, created.slug, userId);
      expect(found).toBeDefined();
      expect(found!.type).toBe('blog');
    });
  });

  // ─── Profile stats ───

  describe('profile stats', () => {
    it('counts article-created content in articles stat', async () => {
      // Create a fresh user for isolated stat counting
      const statUser = await createTestUser(db);

      const blog = await createContent(db, statUser.id, { type: 'blog', title: 'Blog Post' });
      const article = await createContent(db, statUser.id, { type: 'article', title: 'Article Post' });
      await publishContent(db, blog.id, statUser.id);
      await publishContent(db, article.id, statUser.id);

      const profile = await getUserByUsername(db, statUser.username);
      expect(profile).toBeDefined();
      // Both blog and article-created content count together
      expect(profile!.stats.articles).toBe(2);
    });
  });

  // ─── Federation outbound ───

  describe('federation outbound', () => {
    it('sets apObjectId with /blog/ path for article-created content', async () => {
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Federation Path Test',
      });
      await publishContent(db, content.id, userId);

      const config = {
        instance: { domain: 'test.example.com' },
        features: { federation: false },
      } as unknown as CommonPubConfig;
      await onContentPublished(db, content.id, config);

      const [row] = await db
        .select({ apObjectId: contentItems.apObjectId })
        .from(contentItems)
        .where(eq(contentItems.id, content.id));

      // apObjectId should use /blog/ not /article/
      expect(row!.apObjectId).toContain('/blog/');
      expect(row!.apObjectId).not.toContain('/article/');
    });
  });
});
