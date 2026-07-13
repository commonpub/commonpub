import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { contests, contestRegistrations, contestReminderSends, emailOutbox, users } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { sweepContestReminders, formatDeadlineUtc } from '../contest/reminders.js';
import { verifyUnsubscribeToken } from '../comms/unsubscribe.js';

// Automatic deadline reminders: the sweep claims one (contest, participant,
// milestone) ledger row per fire and enqueues exactly once, gated on both flags.

const CTX = { siteUrl: 'https://test.example', siteName: 'Test', secret: 'rem-secret' };
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function cfg(over: Partial<CommonPubConfig['features']> = {}): CommonPubConfig {
  return {
    features: { emailNotifications: true, contestReminders: true, ...over },
    instance: { domain: 'test.example', name: 'Test' },
  } as unknown as CommonPubConfig;
}

async function makeContest(db: DB, createdById: string, endDate: Date, status = 'active'): Promise<string> {
  const [row] = await db
    .insert(contests)
    .values({
      title: 'Deadline Contest',
      slug: `dl-${crypto.randomUUID().slice(0, 8)}`,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate,
      status: status as 'active',
      createdById,
    })
    .returning({ id: contests.id });
  return row!.id;
}

async function register(db: DB, contestId: string, userId: string): Promise<void> {
  await db.insert(contestRegistrations).values({ contestId, userId });
}

describe('sweepContestReminders', () => {
  let db: DB;
  let organizerId: string;
  let verifiedId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'rem-org' })).id;
    const v = await createTestUser(db, { username: 'rem-verified', email: 'v@example.com' });
    verifiedId = v.id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, verifiedId));
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(emailOutbox);
    await db.delete(contestReminderSends);
    await db.delete(contestRegistrations);
    await db.delete(contests);
  });

  it('is inert when contestReminders is off', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const contestId = await makeContest(db, organizerId, new Date(now.getTime() + 6 * DAY));
    await register(db, contestId, verifiedId);
    const res = await sweepContestReminders(db, cfg({ contestReminders: false }), { ...CTX, now });
    expect(res).toEqual({ contests: 0, enqueued: 0 });
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
    expect(await db.select().from(contestReminderSends)).toHaveLength(0);
  });

  it('is inert when emailNotifications is off', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const contestId = await makeContest(db, organizerId, new Date(now.getTime() + 6 * DAY));
    await register(db, contestId, verifiedId);
    const res = await sweepContestReminders(db, cfg({ emailNotifications: false }), { ...CTX, now });
    expect(res.enqueued).toBe(0);
    expect(await db.select().from(contestReminderSends)).toHaveLength(0);
  });

  it('fires the 7-day milestone once and never duplicates', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const contestId = await makeContest(db, organizerId, new Date(now.getTime() + 6 * DAY));
    await register(db, contestId, verifiedId);

    const first = await sweepContestReminders(db, cfg(), { ...CTX, now });
    expect(first.enqueued).toBe(1);

    const ledger = await db.select().from(contestReminderSends);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.milestone).toBe('deadline_T7d');

    // A second sweep at the same time re-claims nothing.
    const second = await sweepContestReminders(db, cfg(), { ...CTX, now });
    expect(second.enqueued).toBe(0);
    expect(await db.select().from(emailOutbox)).toHaveLength(1);
  });

  it('enqueues a reminder with the right subject + valid unsubscribe token', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const endDate = new Date(now.getTime() + 6 * DAY);
    const contestId = await makeContest(db, organizerId, endDate);
    await register(db, contestId, verifiedId);

    await sweepContestReminders(db, cfg(), { ...CTX, now });
    const [m] = await db.select().from(emailOutbox);
    expect(m!.category).toBe('reminder');
    expect(m!.toEmail).toBe('v@example.com');
    expect(m!.subject).toContain('7 days');
    expect(m!.html).toContain(formatDeadlineUtc(endDate));
    const hdr = (m!.headers as Record<string, string>)['List-Unsubscribe']!;
    const token = hdr.match(/token=([^>]+)/)![1]!;
    expect(verifyUnsubscribeToken(token, CTX.secret)).toBe(verifiedId);
  });

  it('sequences milestones as the deadline approaches', async () => {
    const end = new Date('2026-06-10T00:00:00Z');
    const contestId = await makeContest(db, organizerId, end);
    await register(db, contestId, verifiedId);

    // 6 days out: only T7d.
    await sweepContestReminders(db, cfg(), { ...CTX, now: new Date(end.getTime() - 6 * DAY) });
    // 30 hours out: T48h (30 <= 48) fires; T24h (30 > 24) does not yet.
    await sweepContestReminders(db, cfg(), { ...CTX, now: new Date(end.getTime() - 30 * HOUR) });
    // 30 minutes out: T24h and T1h both fire.
    await sweepContestReminders(db, cfg(), { ...CTX, now: new Date(end.getTime() - 30 * 60 * 1000) });

    const milestones = (await db.select().from(contestReminderSends)).map((r) => r.milestone).sort();
    expect(milestones).toEqual(['deadline_T1h', 'deadline_T24h', 'deadline_T48h', 'deadline_T7d'].sort());
    expect(await db.select().from(emailOutbox)).toHaveLength(4);
  });

  it('skips unverified and globally-unsubscribed registrants, and non-registrants', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const contestId = await makeContest(db, organizerId, new Date(now.getTime() + 6 * DAY));

    const unverified = await createTestUser(db, { username: 'rem-unver' });
    const unsub = await createTestUser(db, { username: 'rem-unsub' });
    await db.update(users).set({ emailVerified: true, emailNotifications: { unsubscribedAll: true } }).where(eq(users.id, unsub.id));
    const notRegistered = await createTestUser(db, { username: 'rem-notreg' });
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, notRegistered.id));

    await register(db, contestId, verifiedId);
    await register(db, contestId, unverified.id);
    await register(db, contestId, unsub.id);
    // notRegistered is intentionally not registered.

    const res = await sweepContestReminders(db, cfg(), { ...CTX, now });
    expect(res.enqueued).toBe(1);
    const recipients = (await db.select().from(emailOutbox)).map((m) => m.userId);
    expect(recipients).toEqual([verifiedId]);
  });

  it('ignores contests outside the window or not in an open status', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    // Deadline 10 days out: beyond the widest (7-day) window.
    const far = await makeContest(db, organizerId, new Date(now.getTime() + 10 * DAY));
    // Deadline already passed.
    const past = await makeContest(db, organizerId, new Date(now.getTime() - 1 * HOUR));
    // Within window but completed (not open).
    const completed = await makeContest(db, organizerId, new Date(now.getTime() + 2 * DAY), 'completed');
    for (const c of [far, past, completed]) await register(db, c, verifiedId);

    const res = await sweepContestReminders(db, cfg(), { ...CTX, now });
    expect(res.enqueued).toBe(0);
  });
});
