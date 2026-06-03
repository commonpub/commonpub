/**
 * Reconcile denormalized counters against their source-of-truth tables.
 *
 * Counters (hubs.member_count, contests.entry_count, …) are maintained inline alongside
 * writes. Most of those writes are transactional, but drift can still accumulate (a
 * pre-transaction bug, a manual DB edit, a crash). This script recomputes each counter from
 * its source rows and reports — or fixes — the drift. It is IDEMPOTENT: running it twice with
 * no intervening writes makes no changes the second time.
 *
 * Usage:
 *   node scripts/reconcile-counters.mjs --check     # report drift, change nothing (exit 1 if drift)
 *   node scripts/reconcile-counters.mjs             # fix drift in place
 *
 * Requires NUXT_DATABASE_URL or DATABASE_URL. Safe to run on production (only UPDATEs rows
 * whose stored counter already disagrees with the recomputed value).
 */
import pg from 'pg';

const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('❌ reconcile-counters requires NUXT_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');

/**
 * Each task: a stored counter column and the scalar subquery that recomputes it from source.
 * `recompute` must be a SQL expression correlated to alias `t` (the table being updated).
 */
const tasks = [
  {
    name: 'hubs.member_count',
    table: 'hubs',
    column: 'member_count',
    recompute: `(SELECT count(*) FROM hub_members m WHERE m.hub_id = t.id)`,
  },
  {
    name: 'contests.entry_count',
    table: 'contests',
    column: 'entry_count',
    recompute: `(SELECT count(*) FROM contest_entries e WHERE e.contest_id = t.id)`,
  },
  {
    name: 'events.attendee_count',
    table: 'events',
    column: 'attendee_count',
    recompute: `(SELECT count(*) FROM event_attendees a WHERE a.event_id = t.id AND a.status = 'registered')`,
  },
  {
    name: 'hub_posts.like_count',
    table: 'hub_posts',
    column: 'like_count',
    recompute: `(SELECT count(*) FROM hub_post_likes l WHERE l.post_id = t.id)`,
  },
  {
    name: 'hub_posts.vote_score',
    table: 'hub_posts',
    column: 'vote_score',
    recompute: `(SELECT COALESCE(SUM(CASE WHEN v.direction = 'up' THEN 1 ELSE -1 END), 0) FROM hub_post_votes v WHERE v.post_id = t.id)`,
  },
  {
    name: 'poll_options.vote_count',
    table: 'poll_options',
    column: 'vote_count',
    recompute: `(SELECT count(*) FROM poll_votes v WHERE v.option_id = t.id)`,
  },
  {
    name: 'comments.like_count',
    table: 'comments',
    column: 'like_count',
    recompute: `(SELECT count(*) FROM likes l WHERE l.target_type = 'comment' AND l.target_id = t.id)`,
  },
  {
    name: 'content_items.like_count',
    table: 'content_items',
    column: 'like_count',
    // likes.target_type is the content type (project/article/blog/explainer); match on target_id.
    recompute: `(SELECT count(*) FROM likes l WHERE l.target_id = t.id AND l.target_type IN ('project','article','blog','explainer'))`,
  },
  {
    name: 'content_items.fork_count',
    table: 'content_items',
    column: 'fork_count',
    // content_forks.source_id = the original; counting forks-of-this-item.
    recompute: `(SELECT count(*) FROM content_forks f WHERE f.source_id = t.id)`,
  },
  {
    name: 'content_items.build_count',
    table: 'content_items',
    column: 'build_count',
    recompute: `(SELECT count(*) FROM content_builds b WHERE b.content_id = t.id)`,
  },
];

const pool = new pg.Pool({ connectionString: url, max: 2 });

let totalDrift = 0;
let failed = false;

try {
  for (const task of tasks) {
    const driftQ = `SELECT count(*)::int AS n FROM "${task.table}" t WHERE t."${task.column}" IS DISTINCT FROM ${task.recompute}`;
    let drift;
    try {
      const { rows } = await pool.query(driftQ);
      drift = rows[0]?.n ?? 0;
    } catch (err) {
      // A table/column may not exist on an older DB — report and continue.
      console.warn(`⚠️  ${task.name}: skipped (${err?.message ?? err})`);
      continue;
    }

    if (drift === 0) {
      console.log(`✓ ${task.name}: in sync`);
      continue;
    }

    totalDrift += drift;
    if (checkOnly) {
      console.log(`✗ ${task.name}: ${drift} row(s) drifted`);
    } else {
      await pool.query(
        `UPDATE "${task.table}" t SET "${task.column}" = ${task.recompute} WHERE t."${task.column}" IS DISTINCT FROM ${task.recompute}`,
      );
      console.log(`✔ ${task.name}: fixed ${drift} row(s)`);
    }
  }
} catch (err) {
  console.error('❌ reconcile-counters failed:', err?.message ?? err);
  failed = true;
} finally {
  await pool.end();
}

if (failed) process.exit(1);
if (checkOnly && totalDrift > 0) {
  console.error(`\n${totalDrift} counter row(s) out of sync. Run without --check to fix.`);
  process.exit(1);
}
console.log(checkOnly ? '\n✅ all counters in sync' : '\n✅ reconcile complete');
