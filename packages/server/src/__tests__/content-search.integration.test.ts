/**
 * Integration tests for content search — Postgres FTS fallback.
 * Tests the searchWithPostgres function which is the default when
 * Meilisearch is not configured.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contentItems, tags, contentTags } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { searchWithPostgres, searchContent } from '../search/contentSearch.js';
import { createContent } from '../content/content.js';

describe('content search (Postgres FTS)', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'searchuser', displayName: 'Search User' });
    userId = user.id;

    // Helper: create and publish content
    async function createPublished(input: Parameters<typeof createContent>[2]) {
      const c = await createContent(db, userId, input);
      await db.update(contentItems)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(contentItems.id, c.id));
      return c;
    }

    // Create test content
    await createPublished({
      type: 'project',
      title: 'Arduino Weather Station',
      description: 'Build a solar-powered weather station with Arduino and BME280 sensor',
    });

    await createPublished({
      type: 'project',
      title: 'LED Matrix Display',
      description: 'Create a 16x16 RGB LED matrix with WS2812B and ESP32',
    });

    await createPublished({
      type: 'article',
      title: 'Getting Started with ESP32',
      description: 'A comprehensive guide to the ESP32 microcontroller platform',
    });

    await createPublished({
      type: 'blog',
      title: 'Why I Love Open Source Hardware',
      description: 'Reflections on the maker community and open hardware',
    });

    // Draft — should NOT appear in search
    await createContent(db, userId, {
      type: 'project',
      title: 'Secret Arduino Project',
      description: 'This is a draft and should not be searchable',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Basic search ---

  describe('basic keyword search', () => {
    it('finds content by title keyword', async () => {
      const result = await searchWithPostgres(db, { query: 'Arduino' });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.some(i => i.title.includes('Arduino'))).toBe(true);
    });

    it('finds content by description keyword', async () => {
      const result = await searchWithPostgres(db, { query: 'solar-powered' });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0]!.title).toBe('Arduino Weather Station');
    });

    it('finds content across multiple fields', async () => {
      const result = await searchWithPostgres(db, { query: 'ESP32' });
      // Should find both the LED matrix (ESP32 in description) and the ESP32 article (title)
      expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty for no match', async () => {
      const result = await searchWithPostgres(db, { query: 'quantum computing' });
      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('does NOT return draft content', async () => {
      const result = await searchWithPostgres(db, { query: 'Secret Arduino' });
      expect(result.items.length).toBe(0);
    });
  });

  // --- Type filtering ---

  describe('type filtering', () => {
    it('filters by content type', async () => {
      const result = await searchWithPostgres(db, { query: 'ESP32', type: 'blog' }); // article normalized to blog
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.type).toBe('blog');
    });

    it('returns empty when type does not match', async () => {
      const result = await searchWithPostgres(db, { query: 'Arduino', type: 'blog' });
      expect(result.items.length).toBe(0);
    });
  });

  // --- Author filtering ---

  describe('author filtering', () => {
    it('filters by author username', async () => {
      const result = await searchWithPostgres(db, { query: 'Arduino', authorUsername: 'searchuser' });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0]!.authorUsername).toBe('searchuser');
    });

    it('returns empty for unknown author', async () => {
      const result = await searchWithPostgres(db, { query: 'Arduino', authorUsername: 'nonexistent' });
      expect(result.items.length).toBe(0);
    });
  });

  // --- Date filtering ---

  describe('date filtering', () => {
    it('filters by dateFrom', async () => {
      const result = await searchWithPostgres(db, {
        query: 'Arduino',
        dateFrom: '2020-01-01',
      });
      // All test content was just created — should match
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by dateTo in the past returns nothing', async () => {
      const result = await searchWithPostgres(db, {
        query: 'Arduino',
        dateTo: '2020-01-01',
      });
      expect(result.items.length).toBe(0);
    });
  });

  // --- Sorting ---

  describe('sorting', () => {
    it('sorts by recent (publishedAt desc)', async () => {
      const result = await searchWithPostgres(db, { query: 'ESP32', sort: 'recent' });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('sorts by popular (viewCount desc)', async () => {
      const result = await searchWithPostgres(db, { query: 'ESP32', sort: 'popular' });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Pagination ---

  describe('pagination', () => {
    it('respects limit', async () => {
      const result = await searchWithPostgres(db, { query: 'Arduino', limit: 1 });
      expect(result.items.length).toBe(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('respects offset', async () => {
      const all = await searchWithPostgres(db, { query: 'the', limit: 10 });
      if (all.total > 1) {
        const page2 = await searchWithPostgres(db, { query: 'the', limit: 1, offset: 1 });
        expect(page2.items[0]!.id).not.toBe(all.items[0]!.id);
      }
    });
  });

  // --- Result shape ---

  describe('result shape', () => {
    it('includes all expected fields', async () => {
      const result = await searchWithPostgres(db, { query: 'Arduino' });
      const item = result.items[0]!;
      expect(item.id).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.slug).toBeDefined();
      expect(item.authorId).toBeDefined();
      expect(item.authorUsername).toBe('searchuser');
      expect(item.authorDisplayName).toBe('Search User');
      expect(typeof item.viewCount).toBe('number');
      expect(typeof item.likeCount).toBe('number');
    });
  });

  // --- Unified search function (Postgres fallback) ---

  describe('searchContent (unified)', () => {
    it('uses Postgres when meiliClient is null', async () => {
      const result = await searchContent(db, { query: 'Arduino' }, null);
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('uses Postgres when meiliClient is undefined', async () => {
      const result = await searchContent(db, { query: 'LED' });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });
  });
});
