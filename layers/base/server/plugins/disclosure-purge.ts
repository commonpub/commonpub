/**
 * Disclosure retention purge (member-visibility plan section 3).
 *
 * `disclosure_events` holds one row per (recipient, member) disclosure: the
 * record that answers "who has looked at me" for the member and Art. 15 for
 * everyone else. It is kept for `dataSharing.disclosureRetentionYears` and this
 * worker is what makes that true. A retention period nobody enforces is a
 * retention period nobody has, and an accountability log with no expiry quietly
 * becomes an indefinite record of who looked at whom, which is the opposite of
 * the thing it was built for.
 *
 * WHAT THIS IS NOT. This worker has nothing to do with the aggregate metrics
 * pipeline and shares no code path with it (plan D1). `persona_metrics_daily`
 * exists to make individuals unidentifiable; `disclosure_events` identifies
 * individuals on purpose, with their consent. The two must never be reachable
 * through one module, so this file names only the disclosure table and calls
 * nothing from the metrics side.
 *
 * SCHEDULING mirrors `persona-rollup.ts`: a post-boot delay, then a fixed
 * interval, with the feature flag re-read on EVERY run rather than only at
 * startup, so an operator switching the feature off stops the pass without a
 * redeploy. It staggers behind that worker so two persona passes never start
 * together, and it runs daily rather than 6-hourly because a retention boundary
 * measured in years does not need a finer grain than a day.
 *
 * KNOWN LIMIT, stated rather than hidden: the pass is gated on
 * `features.memberDirectory`, so an instance that turns the directory OFF and
 * restarts stops purging rows the directory already wrote. Those rows still
 * disappear when the member is erased (the table cascades on `users.id`), and
 * turning the flag back on drains the backlog on the next pass, but between
 * those two states the retention window is not enforced. Closing that properly
 * means a retention sweep that does not belong to any one feature; it is filed
 * as a follow-up rather than fixed here by widening this worker's remit.
 *
 * The delete is BOUNDED (batch x max batches). An unbounded `DELETE` over a
 * table nobody has purged for a year is a lock held for as long as it takes,
 * and the work is idempotent, so leaving the tail for tomorrow costs nothing.
 */
import { disclosureEvents } from '@commonpub/schema';
import type { DB } from '@commonpub/server';
import { inArray, lt } from 'drizzle-orm';

/** Daily. The boundary is measured in years; a finer grain buys nothing. */
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** After persona-rollup's 25s, which is after metrics-rollup's 15s. */
const STARTUP_DELAY_MS = 40_000;
/** Rows deleted per statement. */
const BATCH_SIZE = 500;
/** Statements per pass, so one pass cannot run unbounded. 250k rows/day. */
const MAX_BATCHES = 500;

/**
 * Retention bounds, mirrored from `dataSharingConfigSchema.disclosureRetentionYears`.
 *
 * The layer deliberately does not import `@commonpub/persona` (persona plan
 * 14.3: layer server code reaches the pure brain only through
 * `@commonpub/server`), and no resolver for this one number is exported there,
 * so the bounds are restated here and a test pins them to the schema by parsing
 * against the real Zod object. Restating without that guard is how two numbers
 * drift; the guard is what makes the restatement honest.
 */
export const DISCLOSURE_RETENTION_DEFAULT_YEARS = 2;
export const DISCLOSURE_RETENTION_MIN_YEARS = 1;
export const DISCLOSURE_RETENTION_MAX_YEARS = 10;

/**
 * The configured retention, clamped into the schema's bounds.
 *
 * Defensive rather than trusting: `config.dataSharing` is an opaque passthrough
 * as far as `@commonpub/config` is concerned, so a hand-edited config file can
 * put anything at all here. A value out of bounds falls back to the DEFAULT
 * rather than to the minimum: a typo must not be able to silently shorten a
 * retention period, because deleting an accountability record early is not
 * recoverable.
 */
export function resolveDisclosureRetentionYears(dataSharing: unknown): number {
  if (dataSharing === null || typeof dataSharing !== 'object') {
    return DISCLOSURE_RETENTION_DEFAULT_YEARS;
  }
  const raw = (dataSharing as { disclosureRetentionYears?: unknown }).disclosureRetentionYears;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return DISCLOSURE_RETENTION_DEFAULT_YEARS;
  }
  if (raw < DISCLOSURE_RETENTION_MIN_YEARS || raw > DISCLOSURE_RETENTION_MAX_YEARS) {
    return DISCLOSURE_RETENTION_DEFAULT_YEARS;
  }
  return raw;
}

/**
 * The instant before which a disclosure row has expired.
 *
 * Calendar years, not 365-day years, so "two years" means what an operator
 * writing a retention policy means by it. A 29 February anniversary lands on
 * 1 March in a non-leap year, which is JavaScript's own rollover and is one day
 * in the direction of keeping the record slightly longer.
 */
export function disclosureCutoff(retentionYears: number, now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - retentionYears);
  return cutoff;
}

/**
 * Delete expired rows in bounded batches. Returns how many rows went.
 *
 * Exported so the behaviour is testable against a real database without booting
 * the worker's timers. Nitro only ever calls the default export.
 */
export async function purgeExpiredDisclosures(
  db: DB,
  cutoff: Date,
): Promise<{ deleted: number; capped: boolean }> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const rows = await db
      .select({ id: disclosureEvents.id })
      .from(disclosureEvents)
      .where(lt(disclosureEvents.disclosedAt, cutoff))
      .limit(BATCH_SIZE);
    if (rows.length === 0) return { deleted, capped: false };

    await db
      .delete(disclosureEvents)
      .where(inArray(disclosureEvents.id, rows.map((row) => row.id)));
    deleted += rows.length;
  }
  // Hit the ceiling: there is more to delete and tomorrow's pass will take it.
  return { deleted, capped: true };
}

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const startupTimer = setTimeout(() => {
    try {
      if (!enabled()) return;
      console.log(`[disclosure-purge] worker started (interval: ${PURGE_INTERVAL_MS}ms)`);
      void runPurge();
      interval = setInterval(() => void runPurge(), PURGE_INTERVAL_MS);
    } catch (err) {
      console.error('[disclosure-purge] failed to start:', err instanceof Error ? err.message : err);
    }
  }, STARTUP_DELAY_MS);

  /**
   * `memberDirectory` is the flag that governs the surface which WRITES these
   * rows, so it is the flag that governs their expiry. See the header for what
   * this deliberately does not cover.
   */
  function enabled(): boolean {
    return useConfig().features.memberDirectory === true;
  }

  async function runPurge(): Promise<void> {
    // Re-read the flag every run: a startup-only check would keep deleting for
    // a day after an operator switched the feature off.
    if (!enabled()) return;
    // A pass that overruns its interval must not stack up on the same rows.
    if (running) return;
    running = true;
    try {
      const config = useConfig();
      const years = resolveDisclosureRetentionYears(config.dataSharing);
      const cutoff = disclosureCutoff(years);
      const { deleted, capped } = await purgeExpiredDisclosures(useDB(), cutoff);
      if (deleted > 0) {
        console.log(
          `[disclosure-purge] deleted ${deleted} disclosure rows older than `
          + `${cutoff.toISOString()} (${years}y retention)${capped ? ', more remain' : ''}`,
        );
      }
    } catch (err) {
      console.error('[disclosure-purge] run error:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  }

  nitro.hooks.hook('close', () => {
    clearTimeout(startupTimer);
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  });
});
