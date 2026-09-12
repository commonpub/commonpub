import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { contests, contestRegistrations, users } from '@commonpub/schema';
import type { ContestAnnouncementAudience } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { countAnnouncementRecipients, resolveAnnouncementRecipients } from '../contest/announcements.js';

// The announcement audience resolver. The count endpoint and the send MUST agree
// byte for byte -- an organizer who approves "42 recipients" and then mails 51 is
// a bug report. Every test here asserts both paths, so a predicate that drifts in
// one place fails immediately.

const ALL: ContestAnnouncementAudience = { kind: 'registrants', tier: 'all' };

describe('contest announcement audience', () => {
  let db: DB;
  let organizerId: string;
  let contestId: string;

  async function makeUser(
    username: string,
    over: Partial<{ emailVerified: boolean; status: 'active' | 'suspended'; deletedAt: Date | null; emailNotifications: unknown }> = {},
  ): Promise<string> {
    const u = await createTestUser(db, { username, email: `${username}@example.com` });
    await db
      .update(users)
      .set({ emailVerified: over.emailVerified ?? true, ...over } as never)
      .where(eq(users.id, u.id));
    return u.id;
  }

  async function register(userId: string, over: Partial<{ tier: string; emailOptOutAt: Date }> = {}): Promise<void> {
    await db.insert(contestRegistrations).values({ contestId, userId, ...over } as never);
  }

  /** Both read paths for the same audience. They must never disagree. */
  async function both(audience: ContestAnnouncementAudience, allowUnverified = false) {
    const count = await countAnnouncementRecipients(db, contestId, audience, allowUnverified);
    const rows = await resolveAnnouncementRecipients(db, contestId, audience, allowUnverified);
    expect(count).toBe(rows.length);
    return rows;
  }

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'ann-org' })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(contestRegistrations);
    await db.delete(contests);
    const [row] = await db
      .insert(contests)
      .values({
        title: 'Announcement Contest',
        slug: `ann-${crypto.randomUUID().slice(0, 8)}`,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-01T00:00:00Z'),
        status: 'active',
        createdById: organizerId,
      })
      .returning({ id: contests.id });
    contestId = row!.id;
  });

  it('returns every mailable registrant, with the fields a send needs', async () => {
    const a = await makeUser('ann-a');
    await db.update(users).set({ displayName: 'Ann A' }).where(eq(users.id, a));
    await register(a);

    const rows = await both(ALL);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: a, email: 'ann-a@example.com', username: 'ann-a', displayName: 'Ann A' });
  });

  it('returns nobody for a contest with no registrants', async () => {
    expect(await both(ALL)).toHaveLength(0);
  });

  it('never leaks a registrant of a DIFFERENT contest', async () => {
    const [other] = await db
      .insert(contests)
      .values({
        title: 'Other', slug: `oth-${crypto.randomUUID().slice(0, 8)}`,
        startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'),
        status: 'active', createdById: organizerId,
      })
      .returning({ id: contests.id });
    const outsider = await makeUser('ann-outsider');
    await db.insert(contestRegistrations).values({ contestId: other!.id, userId: outsider });

    expect(await both(ALL)).toHaveLength(0);
  });

  describe('tier', () => {
    it('filters to full participants, to reminders-only, or to everyone', async () => {
      const full = await makeUser('ann-full');
      const rem = await makeUser('ann-rem');
      await register(full, { tier: 'full' });
      await register(rem, { tier: 'reminders' });

      expect((await both({ kind: 'registrants', tier: 'full' })).map((r) => r.userId)).toEqual([full]);
      expect((await both({ kind: 'registrants', tier: 'reminders' })).map((r) => r.userId)).toEqual([rem]);
      expect((await both({ kind: 'registrants', tier: 'all' })).map((r) => r.userId).sort()).toEqual([full, rem].sort());
    });
  });

  describe('mailability exclusions', () => {
    it('excludes an unverified address unless the operator opts in', async () => {
      const unv = await makeUser('ann-unverified', { emailVerified: false });
      await register(unv);

      expect(await both(ALL)).toHaveLength(0);
      expect((await both(ALL, true)).map((r) => r.userId)).toEqual([unv]);
    });

    it('excludes a suspended account', async () => {
      const s = await makeUser('ann-suspended', { status: 'suspended' });
      await register(s);
      expect(await both(ALL)).toHaveLength(0);
    });

    it('excludes a soft-deleted account', async () => {
      const d = await makeUser('ann-deleted', { deletedAt: new Date() });
      await register(d);
      expect(await both(ALL)).toHaveLength(0);
    });

    it('excludes a globally unsubscribed user, and keeps one who only set other prefs', async () => {
      const gone = await makeUser('ann-unsub', { emailNotifications: { unsubscribedAll: true } });
      const kept = await makeUser('ann-prefs', { emailNotifications: { digest: 'weekly', likes: false } });
      await register(gone);
      await register(kept);

      expect((await both(ALL)).map((r) => r.userId)).toEqual([kept]);
    });

    it('keeps a user with no prefs row at all (null is not an opt-out)', async () => {
      const n = await makeUser('ann-noprefs', { emailNotifications: null });
      await register(n);
      expect((await both(ALL)).map((r) => r.userId)).toEqual([n]);
    });

    // Per-contest opt-out. No UI sets this yet (P7 is deferred), but the column
    // ships in migration 0049 and the predicate reads it, so the guard is real
    // and proven rather than waiting inertly for a later phase.
    it('excludes a participant who opted out of THIS contest only', async () => {
      const out = await makeUser('ann-optout');
      const inn = await makeUser('ann-optin');
      await register(out, { emailOptOutAt: new Date() });
      await register(inn);

      expect((await both(ALL)).map((r) => r.userId)).toEqual([inn]);
    });
  });

  it('returns a stable, unique-tiebroken order so two reads agree', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await makeUser(`ann-order-${i}`));
    for (const id of ids) await register(id);

    const first = (await resolveAnnouncementRecipients(db, contestId, ALL, false)).map((r) => r.userId);
    const second = (await resolveAnnouncementRecipients(db, contestId, ALL, false)).map((r) => r.userId);
    expect(first).toHaveLength(5);
    expect(first).toEqual(second);
  });
});
