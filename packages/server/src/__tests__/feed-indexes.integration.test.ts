/**
 * Verifies the composite feed indexes (migration 0012) are APPLICABLE to the feed
 * queries — i.e. their column order AND nulls-placement match the feed's ORDER BY so
 * Postgres can use them as an ordered range scan rather than a full scan + Sort.
 *
 * Two things this guards that bit us during authoring:
 *  1. NULLS placement is matched SYNTACTICALLY. `ORDER BY id DESC` is `id DESC NULLS
 *     FIRST` (Postgres' DESC default); an index spelling `id DESC NULLS LAST` is then
 *     deemed inapplicable and the query falls back to a Sort — even though `id` is
 *     NOT NULL. The migration must spell the index's nulls placement to match the query.
 *  2. The DDL is executed from this test directly (not via the pushSchema test helper,
 *     which silently skips partial `WHERE` indexes) so we validate the SHIPPED index
 *     definition, mirroring migration 0012 verbatim.
 *
 * Why force the scan method: on a small seeded table the cost-based planner correctly
 * prefers a seq scan, which would mask an inapplicable index. `SET enable_seqscan = off`
 * isolates applicability from cost — if the index's ordering matches, the planner uses
 * it; if not, the plan still shows a Sort node.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';

// Verbatim from migrations/0012_*.sql — the indexes under test. pushSchema (used by
// createTestDB) skips partial indexes, so we create them explicitly here.
const FEED_RECENCY_INDEX = sql`
  CREATE INDEX IF NOT EXISTS idx_content_items_feed_recency
  ON content_items USING btree (published_at DESC NULLS LAST, id DESC NULLS FIRST)
  WHERE status = 'published' AND deleted_at IS NULL`;
const FEED_POPULAR_INDEX = sql`
  CREATE INDEX IF NOT EXISTS idx_content_items_feed_popular
  ON content_items USING btree (view_count DESC NULLS FIRST, id DESC NULLS FIRST)
  WHERE status = 'published' AND deleted_at IS NULL`;

async function explain(db: DB, query: string): Promise<string> {
  const res = await db.execute(sql.raw(`EXPLAIN ${query}`));
  const rows = (res as unknown as { rows: Array<Record<string, string>> }).rows;
  return rows.map((r) => Object.values(r)[0]).join('\n');
}

describe('feed composite indexes (migration 0012)', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    await db.execute(FEED_RECENCY_INDEX);
    await db.execute(FEED_POPULAR_INDEX);
    const author = await createTestUser(db, { username: 'idx', email: 'idx@test.dev' });
    const rows: Array<typeof contentItems.$inferInsert> = [];
    for (let i = 0; i < 60; i++) {
      rows.push({
        authorId: author.id,
        type: 'project',
        title: `P${i}`,
        slug: `p-${i}`,
        status: 'published',
        viewCount: i % 7,
        publishedAt: new Date(2026, 0, 1 + i),
      });
    }
    await db.insert(contentItems).values(rows);
    // Give the planner real row stats. Without ANALYZE it estimates rows=1, making a
    // Sort of "one row" free, so it never needs the ordered index.
    await db.execute(sql`ANALYZE content_items`);
    await db.execute(sql`SET enable_seqscan = off`);
    await db.execute(sql`SET enable_bitmapscan = off`);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('recency feed ORDER BY uses idx_content_items_feed_recency (no Sort node)', async () => {
    const plan = await explain(
      db,
      `SELECT id FROM content_items
       WHERE status = 'published' AND deleted_at IS NULL
       ORDER BY published_at DESC NULLS LAST, id DESC
       LIMIT 20`,
    );
    expect(plan, plan).toContain('idx_content_items_feed_recency');
    expect(plan, plan).not.toContain('Sort');
  });

  it('popular feed ORDER BY uses idx_content_items_feed_popular (no Sort node)', async () => {
    // view_count is NOT NULL, so the keyset popular sort is plain `DESC` (NULLS FIRST),
    // matching the index — no NULLS LAST here (that would be a different, unusable order).
    const plan = await explain(
      db,
      `SELECT id FROM content_items
       WHERE status = 'published' AND deleted_at IS NULL
       ORDER BY view_count DESC, id DESC
       LIMIT 20`,
    );
    expect(plan, plan).toContain('idx_content_items_feed_popular');
    expect(plan, plan).not.toContain('Sort');
  });
});
