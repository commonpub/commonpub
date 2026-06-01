/**
 * Integration tests for listContentKeyset — Step 3 of the keyset-pagination plan.
 *
 * The property under test is the one the whole 5-release offset saga was about:
 * walking the feed by cursor returns EVERY item exactly once, in the canonical order
 * (publishedAt DESC NULLS LAST, id DESC), with NO duplicates and NO gaps — including
 * across the local+federated keyset-merge and the null-publishedAt tail.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { contentItems, federatedContent } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { listContentKeyset } from '../content/content.js';

/** Walk the whole feed by cursor; return the ordered id list. */
async function walkAll(
  db: DB,
  filters: Parameters<typeof listContentKeyset>[1],
  options: Parameters<typeof listContentKeyset>[2],
  pageSize: number,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 200; guard++) {
    const res = await listContentKeyset(db, { ...filters, cursor, limit: pageSize }, options);
    ids.push(...res.items.map((i) => i.id));
    if (!res.nextCursor || res.items.length === 0) break;
    cursor = res.nextCursor;
  }
  return ids;
}

describe('listContentKeyset — local only', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'ks', email: 'ks@test.dev' });
    userId = user.id;

    const rows: Array<typeof contentItems.$inferInsert> = [];
    // 8 distinct timestamps
    for (let i = 0; i < 8; i++) {
      rows.push({ authorId: userId, type: 'blog', title: `B${i}`, slug: `b-${i}`, status: 'published', publishedAt: new Date(2026, 2, 1 + i) });
    }
    // 5 sharing one timestamp (id tiebreaker)
    const tie = new Date('2026-01-15T00:00:00.000Z');
    for (let i = 0; i < 5; i++) {
      rows.push({ authorId: userId, type: 'blog', title: `T${i}`, slug: `t-${i}`, status: 'published', publishedAt: tie });
    }
    // 3 with null publishedAt (NULLS LAST tail)
    for (let i = 0; i < 3; i++) {
      rows.push({ authorId: userId, type: 'blog', title: `N${i}`, slug: `n-${i}`, status: 'published', publishedAt: null });
    }
    await db.insert(contentItems).values(rows);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('walks all 16 items once, in canonical order, no dups/gaps (page sizes 3/5/16)', async () => {
    // Ground truth: a single ordered scan.
    const full = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(sql`${contentItems.status} = 'published' AND ${contentItems.deletedAt} IS NULL`)
      .orderBy(sql`${contentItems.publishedAt} DESC NULLS LAST`, sql`${contentItems.id} DESC`);
    const expected = full.map((r) => r.id);
    expect(expected.length).toBe(16);

    for (const size of [3, 5, 16]) {
      const walked = await walkAll(db, { type: 'blog', status: 'published' }, undefined, size);
      expect(walked, `pageSize=${size}`).toEqual(expected);
      expect(new Set(walked).size, `pageSize=${size} no dups`).toBe(expected.length);
    }
  });

  it('nextCursor is null on the final (exhausting) page', async () => {
    const res = await listContentKeyset(db, { type: 'blog', status: 'published', limit: 100 });
    expect(res.items.length).toBe(16);
    expect(res.nextCursor).toBeNull();
  });

  it('returns a nextCursor when more rows remain', async () => {
    const res = await listContentKeyset(db, { type: 'blog', status: 'published', limit: 5 });
    expect(res.items.length).toBe(5);
    expect(res.nextCursor).toBeTruthy();
  });
});

describe('listContentKeyset — local + federated keyset-merge', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'ksf', email: 'ksf@test.dev' });
    userId = user.id;

    // Interleave local and federated by timestamp so the merge actually has to
    // interleave the two streams (not just concatenate them).
    const local: Array<typeof contentItems.$inferInsert> = [];
    const fed: Array<typeof federatedContent.$inferInsert> = [];
    for (let i = 0; i < 10; i++) {
      const day = 1 + i * 2; // local on odd-spaced days
      local.push({ authorId: userId, type: 'blog', title: `L${i}`, slug: `l-${i}`, status: 'published', publishedAt: new Date(2026, 3, day) });
      fed.push({
        objectUri: `https://remote.test/o/${i}`,
        actorUri: 'https://remote.test/u/bob',
        originDomain: 'remote.test',
        apType: 'Article',
        cpubType: 'blog',
        title: `F${i}`,
        publishedAt: new Date(2026, 3, day + 1), // federated one day after each local
      });
    }
    await db.insert(contentItems).values(local);
    await db.insert(federatedContent).values(fed);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('merged feed: every page disjoint, all 20 items once, descending by publishedAt', async () => {
    const seen = new Set<string>();
    const order: string[] = [];
    let cursor: string | null = null;
    let lastDate = Infinity;
    for (let guard = 0; guard < 50; guard++) {
      const res = await listContentKeyset(
        db,
        { type: 'blog', status: 'published', cursor, limit: 3 },
        { includeFederated: true },
      );
      for (const item of res.items) {
        expect(seen.has(item.id), `dup ${item.id}`).toBe(false);
        seen.add(item.id);
        order.push(item.id);
        const d = item.publishedAt ? new Date(item.publishedAt).getTime() : -Infinity;
        expect(d, 'descending publishedAt across the whole walk').toBeLessThanOrEqual(lastDate);
        lastDate = d;
      }
      if (!res.nextCursor || res.items.length === 0) break;
      cursor = res.nextCursor;
    }
    expect(order.length).toBe(20); // 10 local + 10 federated
  });

  it('a single large page equals the full merged feed', async () => {
    const res = await listContentKeyset(
      db,
      { type: 'blog', status: 'published', limit: 100 },
      { includeFederated: true },
    );
    expect(res.items.length).toBe(20);
    expect(res.nextCursor).toBeNull();
    // strictly descending publishedAt
    for (let i = 1; i < res.items.length; i++) {
      const prev = new Date(res.items[i - 1]!.publishedAt!).getTime();
      const cur = new Date(res.items[i]!.publishedAt!).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});
