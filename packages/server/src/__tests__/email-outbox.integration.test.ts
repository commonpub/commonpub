import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq, and, or, lt, lte, asc, inArray } from 'drizzle-orm';
import { emailOutbox } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { EmailAdapter, EmailMessage, EmailSendResult } from '../email.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import { enqueueEmail, enqueueEmails, drainEmailOutbox } from '../comms/outbox.js';

// Email Phase 1: durable outbox + throttled/batched/retrying drain worker.

class MockAdapter implements EmailAdapter {
  batches: EmailMessage[][] = [];
  fail = false; // throw → transport failure (whole chunk fails)
  failEmails = new Set<string>(); // per-message rejection (partial-success path)
  async send(m: EmailMessage): Promise<void> { this.batches.push([m]); }
  async sendBatch(msgs: EmailMessage[]): Promise<EmailSendResult[]> {
    if (this.fail) throw new Error('provider 429');
    this.batches.push(msgs);
    return msgs.map((m) => (this.failEmails.has(m.to) ? { ok: false, error: 'rejected' } : { ok: true }));
  }
}

// Anchor enqueue time to the same fixed clock the drain tests inject as `now`, so a row is
// "due" at that clock. Without this, an unscheduled enqueue fell to the DB's real now() (wall
// clock) while the drain ran with a hardcoded fake now — so after 2026-07-01 the real-dated rows
// were never claimed (a deterministic date-bomb, NOT a PGlite flake). session-231 Phase 0.
const BASE_NOW = new Date('2026-07-01T00:00:00Z');

function msg(to: string, scheduledAt: Date = BASE_NOW) {
  return { toEmail: to, subject: 's', html: '<p>h</p>', category: 'notification' as const, scheduledAt };
}

describe('email outbox', () => {
  let db: DB;
  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('claim query emits FOR UPDATE SKIP LOCKED (multi-replica safety)', () => {
    // PGlite is single-connection, so SKIP LOCKED is a no-op at runtime and the
    // other tests can't prove the lock clause survives drizzle's inArray-subquery
    // serialization. Assert the generated SQL directly — without this clause two
    // replicas could claim the same rows and double-send. Mirrors the claim in
    // drainEmailOutbox exactly.
    const now = new Date();
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
      .limit(10)
      .for('update', { skipLocked: true });
    const { sql } = db
      .update(emailOutbox)
      .set({ status: 'sending' })
      .where(inArray(emailOutbox.id, claimIds))
      .toSQL();
    expect(sql.toLowerCase()).toContain('for update skip locked');
  });

  it('enqueues and drains a batch, marking rows sent', async () => {
    await enqueueEmails(db, [msg('a@x.com'), msg('b@x.com'), msg('c@x.com')]);
    const adapter = new MockAdapter();
    const now = new Date('2026-07-01T00:00:00Z');

    const r = await drainEmailOutbox(db, adapter, { batchSize: 2, now, sleep: async () => {} });
    expect(r.claimed).toBe(3);
    expect(r.sent).toBe(3);
    expect(r.failed).toBe(0);
    expect(adapter.batches.map((b) => b.length)).toEqual([2, 1]); // chunked at batchSize

    const rows = await db.select().from(emailOutbox);
    expect(rows.every((x) => x.status === 'sent')).toBe(true);
    expect(rows.every((x) => x.sentAt !== null)).toBe(true);
  });

  it('throttles between provider batches (gap honored)', async () => {
    const fresh = await createTestDB();
    try {
      await enqueueEmails(fresh, [msg('a@y.com'), msg('b@y.com'), msg('c@y.com')]);
      const adapter = new MockAdapter();
      const sleep = vi.fn(async () => {});
      await drainEmailOutbox(fresh, adapter, {
        batchSize: 1, now: new Date('2026-07-01T00:00:00Z'), maxBatchesPerSecond: 5, sleep,
      });
      // 3 chunks → 2 inter-chunk gaps, each 200ms (1000/5).
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(200);
    } finally {
      await closeTestDB(fresh);
    }
  });

  it('reschedules with backoff on failure, then dead-letters at maxAttempts', async () => {
    const fresh = await createTestDB();
    try {
      await enqueueEmail(fresh, msg('fail@z.com'));
      const adapter = new MockAdapter();
      adapter.fail = true;

      // Attempt 1 fails → pending, attempts=1, scheduled into the future.
      const t1 = new Date('2026-07-01T00:00:00Z');
      const r1 = await drainEmailOutbox(fresh, adapter, { maxAttempts: 2, now: t1, sleep: async () => {} });
      expect(r1.sent).toBe(0);
      expect(r1.failed).toBe(0);
      let [row] = await fresh.select().from(emailOutbox);
      expect(row!.status).toBe('pending');
      expect(row!.attempts).toBe(1);
      expect(row!.scheduledAt.getTime()).toBeGreaterThan(t1.getTime());
      expect(row!.lastError).toMatch(/429/);

      // Attempt 2 (clock advanced past the backoff) fails → dead-letter.
      const t2 = new Date('2026-07-01T01:00:00Z');
      const r2 = await drainEmailOutbox(fresh, adapter, { maxAttempts: 2, now: t2, sleep: async () => {} });
      expect(r2.failed).toBe(1);
      [row] = await fresh.select().from(emailOutbox);
      expect(row!.status).toBe('failed');
      expect(row!.attempts).toBe(2);
    } finally {
      await closeTestDB(fresh);
    }
  });

  it('attributes a PARTIAL batch: accepted rows sent, rejected rows rescheduled', async () => {
    const fresh = await createTestDB();
    try {
      await enqueueEmails(fresh, [msg('ok1@p.com'), msg('bad@p.com'), msg('ok2@p.com')]);
      const adapter = new MockAdapter();
      adapter.failEmails.add('bad@p.com'); // provider rejects this one in a 200 batch
      const now = new Date('2026-07-01T00:00:00Z');

      const r = await drainEmailOutbox(fresh, adapter, { now, sleep: async () => {} });
      expect(r.claimed).toBe(3);
      expect(r.sent).toBe(2);
      expect(r.failed).toBe(0); // rejected one is rescheduled, not dead-lettered

      const rows = await fresh.select().from(emailOutbox);
      const bad = rows.find((x) => x.toEmail === 'bad@p.com')!;
      expect(bad.status).toBe('pending');
      expect(bad.attempts).toBe(1);
      expect(rows.filter((x) => x.status === 'sent')).toHaveLength(2);
    } finally {
      await closeTestDB(fresh);
    }
  });

  it('floors batchSize to 1 so a 0 batchSize cannot infinite-loop the chunker', async () => {
    const fresh = await createTestDB();
    try {
      await enqueueEmails(fresh, [msg('a@f.com'), msg('b@f.com')]);
      const adapter = new MockAdapter();
      const now = new Date('2026-07-01T00:00:00Z');
      // batchSize 0 previously made `i += 0` spin forever; it must floor to 1.
      const r = await drainEmailOutbox(fresh, adapter, { batchSize: 0, now, sleep: async () => {} });
      expect(r.sent).toBe(2);
      expect(adapter.batches.every((b) => b.length === 1)).toBe(true); // chunked at 1
    } finally {
      await closeTestDB(fresh);
    }
  });

  it('does not claim rows scheduled in the future', async () => {
    const fresh = await createTestDB();
    try {
      const now = new Date('2026-07-01T00:00:00Z');
      await enqueueEmail(fresh, msg('later@z.com', new Date(now.getTime() + 60 * 60 * 1000)));
      const r = await drainEmailOutbox(fresh, new MockAdapter(), { now, sleep: async () => {} });
      expect(r.claimed).toBe(0);
    } finally {
      await closeTestDB(fresh);
    }
  });

  it('reclaims a stale-locked row (crashed worker)', async () => {
    const fresh = await createTestDB();
    try {
      await enqueueEmail(fresh, msg('stale@z.com'));
      // Simulate a worker that claimed the row then crashed: status 'sending',
      // lock expired 10 minutes ago.
      const past = new Date('2026-06-30T23:50:00Z');
      await fresh.update(emailOutbox).set({ status: 'sending', claimedAt: past, lockExpiresAt: past });
      const now = new Date('2026-07-01T00:00:00Z');
      const r = await drainEmailOutbox(fresh, new MockAdapter(), { now, sleep: async () => {} });
      expect(r.claimed).toBe(1);
      expect(r.sent).toBe(1);
    } finally {
      await closeTestDB(fresh);
    }
  });
});
