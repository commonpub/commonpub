import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { emailOutbox } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { EmailAdapter, EmailMessage } from '../email.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import { enqueueEmail, enqueueEmails, drainEmailOutbox } from '../comms/outbox.js';

// Email Phase 1: durable outbox + throttled/batched/retrying drain worker.

class MockAdapter implements EmailAdapter {
  batches: EmailMessage[][] = [];
  fail = false;
  async send(m: EmailMessage): Promise<void> { this.batches.push([m]); }
  async sendBatch(msgs: EmailMessage[]): Promise<void> {
    if (this.fail) throw new Error('provider 429');
    this.batches.push(msgs);
  }
}

function msg(to: string, scheduledAt?: Date) {
  return { toEmail: to, subject: 's', html: '<p>h</p>', category: 'notification' as const, scheduledAt };
}

describe('email outbox', () => {
  let db: DB;
  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

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
