import { sql } from 'drizzle-orm';

/**
 * Readiness probe. Beyond a bare liveness 200, it confirms the critical
 * dependency — Postgres — is reachable with a trivial `SELECT 1`, and returns
 * 503 when it isn't so a load balancer / uptime monitor can pull the instance
 * out of rotation instead of routing traffic to a process that will 500 every
 * query. Redis fail-open events are already surfaced by the rate-limit
 * middleware's structured logger; storage failures surface on the upload path.
 * The handler never throws — a probe that 500s is indistinguishable from a
 * crash to most monitors.
 */
export default defineEventHandler(async (event) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  let healthy = true;

  try {
    const db = useDB();
    await db.execute(sql`select 1`);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  if (!healthy) setResponseStatus(event, 503);
  return {
    status: healthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  };
});
