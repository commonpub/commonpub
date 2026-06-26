import { and, or, eq, lt, lte, asc, inArray } from 'drizzle-orm';
import { emailOutbox } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { EmailAdapter, EmailMessage, EmailSendResult } from '../email.js';

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
 * Claim and deliver a batch of pending emails. Crash-safe + multi-replica-safe:
 * claims with `FOR UPDATE SKIP LOCKED` + a lock expiry, and RENEWS that lease per
 * chunk while it works — so a live worker's in-flight rows are never reclaimed
 * (no matter how long the whole tick runs), while a crashed worker stops renewing
 * and its rows are reclaimed once stale. A provider failure reschedules with
 * backoff (no mail lost) until `maxAttempts`, then dead-letters (`status='failed'`).
 *
 * At-least-once: if a worker dies in the window between a provider accepting a
 * message and this function marking the row `sent`, the row is reclaimed and
 * re-sent (a rare duplicate). This is the standard email-queue guarantee; provider
 * idempotency keys could tighten it to effectively-once later.
 *
 * Pure-ish: takes the db + adapter, so it's unit-testable with a mock adapter and
 * an injected clock. The Nitro plugin just calls this on an interval.
 */
export async function drainEmailOutbox(
  db: DB,
  adapter: EmailAdapter,
  opts: DrainOptions = {},
): Promise<DrainResult> {
  // Floor batchSize at 1: a 0/negative step would make the chunking loop spin
  // forever (i never advances). Cap at 100 (Resend's batch limit).
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 100, 100));
  const maxAttempts = opts.maxAttempts ?? 6;
  const maxBatchesPerSecond = opts.maxBatchesPerSecond ?? 5;
  const now = opts.now ?? new Date();
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const lockExpiry = new Date(now.getTime() + LOCK_TTL_MS);
  const gapMs = Math.ceil(1000 / Math.max(1, maxBatchesPerSecond));
  // Plain work bound per tick (default 200). Safety against cross-replica reclaim
  // comes from the per-chunk lease renewal below, NOT from bounding tick duration,
  // so a large maxPerTick only makes a tick slower, never unsafe.
  const maxPerTick = Math.max(1, opts.maxPerTick ?? 200);

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

    // Renew the lease on this chunk's rows against WALL-CLOCK time before sending,
    // so a long multi-chunk tick can't let another replica reclaim rows we're still
    // working. A single chunk is bounded (<= batchSize rows, each provider call
    // capped by the HTTP timeout), so the renewed lease always outlives the chunk.
    // Only rows still 'sending' under our claim are renewed.
    const chunkIds = chunk.map((r) => r.id);
    await db
      .update(emailOutbox)
      .set({ lockExpiresAt: new Date(Date.now() + LOCK_TTL_MS) })
      .where(and(inArray(emailOutbox.id, chunkIds), eq(emailOutbox.status, 'sending')));

    // Per-message outcomes. A thrown error = transport failure where nothing was
    // accepted → treat every message as failed (retry the whole chunk). A returned
    // array attributes each message, so a partial provider acceptance marks only
    // the accepted rows sent and reschedules the rejected ones (no loss, no blind
    // resend of the whole chunk).
    let results: EmailSendResult[];
    try {
      results = await adapter.sendBatch(chunk.map(rowToMessage));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results = chunk.map(() => ({ ok: false, error: msg }));
    }

    const okIds: string[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const row = chunk[i]!;
      const res = results[i] ?? { ok: false, error: 'no provider result' };
      if (res.ok) {
        okIds.push(row.id);
        continue;
      }
      // Reschedule (or dead-letter) the failed row, attempt-accurate.
      const attempts = row.attempts + 1;
      if (attempts >= maxAttempts) {
        await db
          .update(emailOutbox)
          .set({ status: 'failed', attempts, lastError: res.error ?? 'send failed' })
          .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, 'sending')));
        failed++;
      } else {
        await db
          .update(emailOutbox)
          .set({
            status: 'pending',
            attempts,
            lastError: res.error ?? 'send failed',
            scheduledAt: new Date(now.getTime() + backoffMs(attempts)),
            claimedAt: null,
            lockExpiresAt: null,
          })
          .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, 'sending')));
      }
    }

    if (okIds.length > 0) {
      // Guard on status='sending': a row already moved to a terminal/pending state
      // (e.g. by a reclaiming worker after a crash) is left alone. Per-chunk lease
      // renewal above is what actually prevents a live worker's rows from being
      // reclaimed mid-tick; this guard is defense in depth for the crash path.
      await db
        .update(emailOutbox)
        .set({ status: 'sent', sentAt: now, lastError: null })
        .where(and(inArray(emailOutbox.id, okIds), eq(emailOutbox.status, 'sending')));
      sent += okIds.length;
    }

    // Throttle provider API calls to the rate limit (skip after the last chunk).
    if (c < chunks.length - 1) await sleep(gapMs);
  }

  return { claimed: claimed.length, sent, failed };
}
