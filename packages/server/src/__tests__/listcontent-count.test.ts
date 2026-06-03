/**
 * listContent computes COUNT(*) only on the first page (offset 0); deeper pages return
 * total = -1 ("not computed"). Pagination phase B — feed clients use items.length < limit
 * and only read `total` on page 1. This locks that contract so a future change can't silently
 * reintroduce a full COUNT on every load-more.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { listContent } from '../content/content.js';

describe('listContent COUNT page-1-only', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db, { username: 'counter' });
    // 5 published+public blog posts
    for (let i = 0; i < 5; i++) {
      await db.insert(contentItems).values({
        authorId: u.id,
        type: 'blog',
        title: `Post ${i}`,
        slug: `post-${i}`,
        status: 'published',
        visibility: 'public',
        publishedAt: new Date(Date.now() - i * 60_000),
      });
    }
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('returns the real total on page 1 (offset 0)', async () => {
    const res = await listContent(db, { limit: 2, offset: 0 });
    expect(res.items.length).toBe(2);
    expect(res.total).toBe(5);
  });

  it('returns total = -1 on deeper pages (offset > 0)', async () => {
    const res = await listContent(db, { limit: 2, offset: 2 });
    expect(res.items.length).toBe(2);
    expect(res.total).toBe(-1);
  });
});
