import { and, or, eq, lt, lte, asc, inArray } from 'drizzle-orm';
import { emailOutbox } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { EmailAdapter, EmailMessage } from '../email.js';

// Durable email outbox (email Phase 1). Producers ENQUEUE; a single throttled
// worker DRAINS. Separation of concerns: this module knows nothing about
// templates or who sends what — it just reliably delivers rows with batching,
// throttling, retry/backoff, and a crash-safe claim. See schema/comms.ts.

export type EmailCategory = 'notification' | 'digest' | 'broadcast';

export interface OutboxMessage {
  toEmail: string;
  /** Owner — nullable; a deleted user's queued mail cascades away. */
  userId?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  headers?: Record<string, string> | null;
  category: EmailCategory;
  /** Defer delivery until this time (defaults to now). */
  scheduledAt?: Date;
}

function toRow(m: OutboxMessage) {
  return {
    toEmail: m.toEmail,
    userId: m.userId ?? null,
    subject: m.subject,
    html: m.html,
    text: m.text ?? null,
    headers: m.headers ?? null,
    category: m.category,
    scheduledAt: m.scheduledAt ?? undefined, // undefined → DB default now()
  };
}

/** Enqueue a single email for the worker to deliver. */
export async function enqueueEmail(db: DB, message: OutboxMessage): Promise<void> {
  await db.insert(emailOutbox).values(toRow(message));
}

/** Enqueue many emails in one insert (digest fan-out, broadcasts). */
export async function enqueueEmails(db: DB, messages: OutboxMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await db.insert(emailOutbox).values(messages.map(toRow));
}

export interface DrainOptions {
  /** Max rows claimed per tick (default 200). */
  maxPerTick?: number;
  /** Messages per provider batch call, <= 100 for Resend (default 100). */
  batchSize?: number;
  /** Dead-letter a row after this many failed attempts (default 6). */
  maxAttempts?: number;
  /** Cap provider API calls/sec to respect the provider rate limit (default 5). */
  maxBatchesPerSecond?: number;
  /** Injectable clock for tests. */
  now?: Date;
  /** Injectable sleep for tests (default real setTimeout). */
  sleep?: (ms: number) => Promise<void>;
}

export interface DrainResult {
  claimed: number;
  sent: number;
  failed: number;
}

const LOCK_TTL_MS = 5 * 60 * 1000;

/** Exponential backoff for the NEXT retry (1→2min, 2→4min, ... capped 1h). */
function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 60_000, 60 * 60_000);
}

function rowToMessage(row: typeof emailOutbox.$inferSelect): EmailMessage {
  return {
    to: row.toEmail,
    subject: row.subject,
    html: row.html,
    text: row.text ?? undefined,
    headers: row.headers ?? undefined,
  };
}

/**
 * Claim and deliver a batch of pending emails. Crash-safe: claims with
 * `FOR UPDATE SKIP LOCKED` + a lock expiry, so concurrent workers never grab the
 * same row and a crashed worker's rows are reclaimed once stale. A provider batch
 * failure reschedules the whole chunk with backoff (no mail lost) until
 * `maxAttempts`, then dead-letters it (`status='failed'`). Returns counts.
 *
 * Pure-ish: takes the db + adapter, so it's unit-testable with a mock adapter and
 * an injected clock. The Nitro plugin just calls this on an interval.
 */
export async function drainEmailOutbox(
  db: DB,
  adapter: EmailAdapter,
  opts: DrainOptions = {},
): Promise<DrainResult> {
  const maxPerTick = opts.maxPerTick ?? 200;
  const batchSize = Math.min(opts.batchSize ?? 100, 100);
  const maxAttempts = opts.maxAttempts ?? 6;
  const maxBatchesPerSecond = opts.maxBatchesPerSecond ?? 5;
  const now = opts.now ?? new Date();
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const lockExpiry = new Date(now.getTime() + LOCK_TTL_MS);
  const gapMs = Math.ceil(1000 / Math.max(1, maxBatchesPerSecond));

  // Claim: pending+due rows, plus stale 'sending' rows whose lock expired (a
  // crashed worker). SKIP LOCKED so parallel workers don't collide.
  const claimIds = db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(
      or(
        and(eq(emailOutbox.status, 'pending'), lte(emailOutbox.scheduledAt, now)),
        and(eq(emailOutbox.status, 'sending'), lt(emailOutbox.lockExpiresAt, now)),
      ),
    )
    .orderBy(asc(emailOutbox.scheduledAt))
    .limit(maxPerTick)
    .for('update', { skipLocked: true });

  const claimed = await db
    .update(emailOutbox)
    .set({ status: 'sending', claimedAt: now, lockExpiresAt: lockExpiry })
    .where(inArray(emailOutbox.id, claimIds))
    .returning();

  if (claimed.length === 0) return { claimed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const chunks: (typeof claimed)[] = [];
  for (let i = 0; i < claimed.length; i += batchSize) chunks.push(claimed.slice(i, i + batchSize));

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c]!;
    try {
      await adapter.sendBatch(chunk.map(rowToMessage));
      await db
        .update(emailOutbox)
        .set({ status: 'sent', sentAt: now, lastError: null })
        .where(inArray(emailOutbox.id, chunk.map((r) => r.id)));
      sent += chunk.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Reschedule (or dead-letter) each row in the failed chunk individually so
      // the attempt counter is per-row accurate.
      for (const row of chunk) {
        const attempts = row.attempts + 1;
        if (attempts >= maxAttempts) {
          await db
            .update(emailOutbox)
            .set({ status: 'failed', attempts, lastError: msg })
            .where(eq(emailOutbox.id, row.id));
          failed++;
        } else {
          await db
            .update(emailOutbox)
            .set({
              status: 'pending',
              attempts,
              lastError: msg,
              scheduledAt: new Date(now.getTime() + backoffMs(attempts)),
              claimedAt: null,
              lockExpiresAt: null,
            })
            .where(eq(emailOutbox.id, row.id));
        }
      }
    }
    // Throttle provider API calls to the rate limit (skip after the last chunk).
    if (c < chunks.length - 1) await sleep(gapMs);
  }

  return { claimed: claimed.length, sent, failed };
}
