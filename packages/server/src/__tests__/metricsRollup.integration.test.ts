import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { metricsDaily, users, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import {
  runDailyRollup,
  backfillMetricsDaily,
  getMetricsTimeseries,
} from '../publicApi/index.js';

const DIM = '';

async function valueOf(db: DB, metric: string, day: string): Promise<number | undefined> {
  const [row] = await db
    .select({ value: metricsDaily.value })
    .from(metricsDaily)
    .where(and(eq(metricsDaily.metric, metric), eq(metricsDaily.day, day), eq(metricsDaily.dimension, DIM)));
  return row?.value;
}

describe('publicApi metricsRollup (integration)', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    // Suspended author: excluded from user metrics (so user counts stay
    // deterministic regardless of the real run date), but their published
    // content still counts. Fixed createdAt keeps the test date-independent.
    const [authorRow] = await db
      .insert(users)
      .values({ email: 'author@x.com', username: 'author', status: 'suspended', createdAt: new Date('2026-01-01T00:00:00Z') })
      .returning();
    const author = authorRow!.id;

    // Users with controlled signup dates (all active).
    await db.insert(users).values([
      { email: 'u1@x.com', username: 'u1', createdAt: new Date('2026-01-01T10:00:00Z') },
      { email: 'u2@x.com', username: 'u2', createdAt: new Date('2026-01-01T12:00:00Z') },
      { email: 'u3@x.com', username: 'u3', createdAt: new Date('2026-01-03T09:00:00Z') },
    ]);

    // Content with controlled publish dates.
    const mk = (slug: string, day: string, views: number, likes: number, comments: number) => ({
      authorId: author,
      title: slug,
      slug,
      type: 'blog' as const,
      status: 'published' as const,
      visibility: 'public' as const,
      viewCount: views,
      likeCount: likes,
      commentCount: comments,
      publishedAt: new Date(`${day}T08:00:00Z`),
    });
    await db.insert(contentItems).values([
      mk('c1', '2026-01-02', 100, 10, 5),
      mk('c2', '2026-01-02', 50, 5, 2),
      mk('c3', '2026-01-05', 30, 3, 1),
    ]);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('backfillMetricsDaily', () => {
    it('writes flow + cumulative series from timestamps', async () => {
      const written = await backfillMetricsDaily(db);
      expect(written).toBeGreaterThan(0);

      // users.new flow: 2 on 01-01, 1 on 01-03. (createTestUser 'author' adds 1 on "today".)
      expect(await valueOf(db, 'users.new', '2026-01-01')).toBe(2);
      expect(await valueOf(db, 'users.new', '2026-01-03')).toBe(1);
      // users.total cumulative survivorship curve.
      expect(await valueOf(db, 'users.total', '2026-01-01')).toBe(2);
      expect(await valueOf(db, 'users.total', '2026-01-03')).toBe(3);

      // content.new flow + cumulative.
      expect(await valueOf(db, 'content.new', '2026-01-02')).toBe(2);
      expect(await valueOf(db, 'content.new', '2026-01-05')).toBe(1);
      expect(await valueOf(db, 'content.total', '2026-01-02')).toBe(2);
      expect(await valueOf(db, 'content.total', '2026-01-05')).toBe(3);
    });

    it('is idempotent (re-run does not duplicate rows or change values)', async () => {
      const before = await db.select().from(metricsDaily);
      await backfillMetricsDaily(db);
      const after = await db.select().from(metricsDaily);
      expect(after.length).toBe(before.length);
      expect(await valueOf(db, 'content.total', '2026-01-05')).toBe(3);
    });

    it('does NOT backfill sum-based engagement metrics (no per-day history)', async () => {
      expect(await valueOf(db, 'content.views', '2026-01-02')).toBeUndefined();
    });
  });

  describe('runDailyRollup', () => {
    it('snapshots current totals + engagement sums under the given day', async () => {
      await runDailyRollup(db, '2026-06-04');
      expect(await valueOf(db, 'users.total', '2026-06-04')).toBe(3); // 3 active seeded (author is suspended)
      expect(await valueOf(db, 'content.total', '2026-06-04')).toBe(3);
      expect(await valueOf(db, 'content.views', '2026-06-04')).toBe(180); // 100+50+30
      expect(await valueOf(db, 'content.likes', '2026-06-04')).toBe(18);
      expect(await valueOf(db, 'content.comments', '2026-06-04')).toBe(8);
      // Nothing was created/published on 2026-06-04.
      expect(await valueOf(db, 'users.new', '2026-06-04')).toBe(0);
      expect(await valueOf(db, 'content.new', '2026-06-04')).toBe(0);
    });

    it('is idempotent for the same day', async () => {
      await runDailyRollup(db, '2026-06-04');
      expect(await valueOf(db, 'content.views', '2026-06-04')).toBe(180);
    });
  });

  describe('getMetricsTimeseries', () => {
    it('returns flow points with day-over-day deltas', async () => {
      const ts = await getMetricsTimeseries(db, { metric: 'users.new', interval: 'day', from: '2026-01-01', to: '2026-01-31' });
      expect(ts.kind).toBe('flow');
      expect(ts.points).toEqual([
        { date: '2026-01-01', value: 2, delta: 0 },
        { date: '2026-01-03', value: 1, delta: -1 },
      ]);
      expect(ts.since).toBe('2026-01-01');
    });

    it('returns cumulative points', async () => {
      const ts = await getMetricsTimeseries(db, { metric: 'users.total', interval: 'day', from: '2026-01-01', to: '2026-01-31' });
      expect(ts.points).toEqual([
        { date: '2026-01-01', value: 2, delta: 0 },
        { date: '2026-01-03', value: 3, delta: 1 },
      ]);
    });

    it('buckets flow by week (sum) and month (sum)', async () => {
      const week = await getMetricsTimeseries(db, { metric: 'users.new', interval: 'week', from: '2025-12-01', to: '2026-02-01' });
      // 2026-01-01 (Thu) and 2026-01-03 (Sat) share ISO week starting Mon 2025-12-29.
      expect(week.points).toEqual([{ date: '2025-12-29', value: 3, delta: 0 }]);

      const month = await getMetricsTimeseries(db, { metric: 'content.new', interval: 'month', from: '2026-01-01', to: '2026-01-31' });
      expect(month.points).toEqual([{ date: '2026-01-01', value: 3, delta: 0 }]); // 2 + 1 in January
    });

    it('buckets cumulative by month (last value in bucket)', async () => {
      const month = await getMetricsTimeseries(db, { metric: 'content.total', interval: 'month', from: '2026-01-01', to: '2026-01-31' });
      expect(month.points).toEqual([{ date: '2026-01-01', value: 3, delta: 0 }]); // last (01-05) value
    });

    it('throws on an unknown metric', async () => {
      await expect(
        getMetricsTimeseries(db, { metric: 'secret.metric', interval: 'day', from: '2026-01-01', to: '2026-12-31' }),
      ).rejects.toThrow(/Unknown metric/);
    });
  });
});
