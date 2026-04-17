import { apiKeyUsage } from '@commonpub/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { DB } from '../types.js';

export interface ApiKeyUsageStats {
  windowDays: number;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  /** Array of { day: 'YYYY-MM-DD', count: number }, newest first. */
  requestsByDay: Array<{ day: string; count: number }>;
  /** Top endpoints by request count within the window. */
  topEndpoints: Array<{ endpoint: string; count: number; p95LatencyMs: number | null }>;
}

/**
 * Per-key usage analytics for the admin dashboard. Narrow, indexed queries
 * only — no full-table scans. Uses `count(*) FILTER (WHERE ...)` conditional
 * aggregation so the totals, error counts, and day buckets come from a
 * single round-trip where possible.
 */
export async function getApiKeyUsageStats(
  db: DB,
  keyId: string,
  windowDays = 7,
): Promise<ApiKeyUsageStats> {
  const since = new Date(Date.now() - windowDays * 86400_000);
  const base = and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.timestamp, since));

  const [[totals], byDay, byEndpoint] = await Promise.all([
    db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        errorCount: sql<number>`count(*) FILTER (WHERE ${apiKeyUsage.statusCode} >= 400)::int`,
      })
      .from(apiKeyUsage)
      .where(base),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${apiKeyUsage.timestamp}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(apiKeyUsage)
      .where(base)
      .groupBy(sql`date_trunc('day', ${apiKeyUsage.timestamp})`)
      .orderBy(desc(sql`date_trunc('day', ${apiKeyUsage.timestamp})`)),
    db
      .select({
        endpoint: apiKeyUsage.endpoint,
        count: sql<number>`count(*)::int`,
        p95LatencyMs: sql<number | null>`percentile_cont(0.95) within group (order by ${apiKeyUsage.latencyMs})::int`,
      })
      .from(apiKeyUsage)
      .where(base)
      .groupBy(apiKeyUsage.endpoint)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10),
  ]);

  const totalRequests = totals?.totalRequests ?? 0;
  const errorCount = totals?.errorCount ?? 0;

  return {
    windowDays,
    totalRequests,
    errorCount,
    errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
    requestsByDay: byDay.map((r) => ({ day: r.day, count: r.count })),
    topEndpoints: byEndpoint.map((r) => ({
      endpoint: r.endpoint,
      count: r.count,
      p95LatencyMs: r.p95LatencyMs,
    })),
  };
}
