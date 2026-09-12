import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  contests, contestRegistrations, contestAnnouncements, contestAnnouncementSends, emailOutbox, users,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  sendContestAnnouncement, listContestAnnouncements, claimAnnouncementRecipients, AnnouncementRateLimitError,
} from '../contest/announcements.js';
import { verifyUnsubscribeToken } from '../comms/unsubscribe.js';

// The send. An organizer's arbitrary email reaches every mailable registrant
// exactly once, rendered per recipient, through the durable outbox.

const CTX = { siteUrl: 'https://test.example', siteName: 'Test', secret: 'ann-secret' };

const BODY = [
  ['heading', { text: 'Hi {username},', level: 2 }],
  ['paragraph', { text: 'Kickoff for {contestTitle} is Monday.' }],
];

describe('sendContestAnnouncement', () => {
  let db: DB;
  let organizerId: string;
  let contestId: string;
  let contestSlug: string;

  async function makeUser(username: string): Promise<string> {
    const u = await createTestUser(db, { username, email: `${username}@example.com` });
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, u.id));
    return u.id;
  }

  async function register(userId: string): Promise<void> {
    await db.insert(contestRegistrations).values({ contestId, userId });
  }

  /** The contest row shape `announcementContext` needs, alongside the ids. */
  function contestRow(over: Record<string, unknown> = {}) {
    return {
      title: 'Summer Build-Off',
      slug: contestSlug,
      status: 'active',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-01T00:00:00Z'),
      judgingEndDate: null,
      ...over,
    };
  }

  function input(over: Record<string, unknown> = {}) {
    return {
      contestId,
      contest: contestRow(),
      subject: 'An update on {contestTitle}',
      bodyBlocks: BODY,
      audience: { kind: 'registrants' as const, tier: 'all' as const },
      sentBy: organizerId,
      idempotencyKey: crypto.randomUUID(),
      ...over,
    };
  }

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'snd-org' })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(emailOutbox);
    await db.delete(contestAnnouncementSends);
    await db.delete(contestAnnouncements);
    await db.delete(contestRegistrations);
    await db.delete(contests);
    contestSlug = `snd-${crypto.randomUUID().slice(0, 8)}`;
    const [row] = await db
      .insert(contests)
      .values({
        title: 'Summer Build-Off', slug: contestSlug,
        startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'),
        status: 'active', createdById: organizerId,
      })
      .returning({ id: contests.id });
    contestId = row!.id;
  });

  it('enqueues one email per mailable registrant and records the announcement', async () => {
    const a = await makeUser('snd-a');
    const b = await makeUser('snd-b');
    await register(a);
    await register(b);

    const res = await sendContestAnnouncement(db, input(), CTX);
    expect(res.recipientCount).toBe(2);

    const queued = await db.select().from(emailOutbox);
    expect(queued).toHaveLength(2);
    expect(queued.every((m) => m.category === 'announcement')).toBe(true);
    expect(new Set(queued.map((m) => m.toEmail))).toEqual(new Set(['snd-a@example.com', 'snd-b@example.com']));

    const [row] = await db.select().from(contestAnnouncements);
    expect(row).toMatchObject({ contestId, recipientCount: 2, status: 'sent', sentById: organizerId });
    expect(row!.sentAt).toBeInstanceOf(Date);

    expect(await db.select().from(contestAnnouncementSends)).toHaveLength(2);
  });

  it('resolves tokens PER RECIPIENT, so each person sees their own name', async () => {
    const a = await makeUser('snd-ada');
    const b = await makeUser('snd-bob');
    await register(a);
    await register(b);

    await sendContestAnnouncement(db, input(), CTX);
    const queued = await db.select().from(emailOutbox);
    const ada = queued.find((m) => m.toEmail === 'snd-ada@example.com')!;
    const bob = queued.find((m) => m.toEmail === 'snd-bob@example.com')!;

    expect(ada.html).toContain('Hi snd-ada,');
    expect(bob.html).toContain('Hi snd-bob,');
    expect(ada.html).not.toContain('snd-bob');
  });

  it('resolves contest-wide tokens in the body and the subject', async () => {
    await register(await makeUser('snd-tok'));
    await sendContestAnnouncement(db, input(), CTX);
    const [m] = await db.select().from(emailOutbox);
    expect(m!.subject).toBe('An update on Summer Build-Off');
    expect(m!.html).toContain('Kickoff for Summer Build-Off is Monday.');
  });

  it('gives each recipient their OWN valid one-click unsubscribe token', async () => {
    const a = await makeUser('snd-unsub');
    await register(a);
    await sendContestAnnouncement(db, input(), CTX);

    const [m] = await db.select().from(emailOutbox);
    const headers = m!.headers as Record<string, string>;
    expect(headers['List-Unsubscribe']).toBeTruthy();
    expect(headers['List-Unsubscribe-Post']).toContain('One-Click');

    const token = /[?&]token=([^&"'>\s]+)/.exec(m!.html)?.[1];
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken(decodeURIComponent(token!), CTX.secret)).toBe(a);
  });

  it('absolutizes block URLs, so no root-relative href reaches an inbox', async () => {
    await register(await makeUser('snd-abs'));
    await sendContestAnnouncement(db, input({ bodyBlocks: [['registrationLink', {}]] }), CTX);
    const [m] = await db.select().from(emailOutbox);
    expect(m!.html).not.toMatch(/href="\/[^/]/);
    expect(m!.html).toContain(`${CTX.siteUrl}/contests/${contestSlug}/register`);
  });

  it('skips a registrant the audience excludes, and never mails them', async () => {
    const keep = await makeUser('snd-keep');
    const drop = await createTestUser(db, { username: 'snd-drop', email: 'snd-drop@example.com' }); // unverified
    await register(keep);
    await register(drop.id);

    const res = await sendContestAnnouncement(db, input(), CTX);
    expect(res.recipientCount).toBe(1);
    expect((await db.select().from(emailOutbox)).map((m) => m.toEmail)).toEqual(['snd-keep@example.com']);
  });

  // The double-click guard. Two POSTs from one compose session carry the same
  // idempotency key; the second must return the first announcement and mail nobody.
  it('is idempotent for a repeated key: no second announcement, no second email', async () => {
    await register(await makeUser('snd-idem'));
    const key = crypto.randomUUID();

    const first = await sendContestAnnouncement(db, input({ idempotencyKey: key }), CTX);
    const second = await sendContestAnnouncement(db, input({ idempotencyKey: key }), CTX);

    expect(second.announcementId).toBe(first.announcementId);
    expect(second.duplicate).toBe(true);
    expect(await db.select().from(contestAnnouncements)).toHaveLength(1);
    expect(await db.select().from(emailOutbox)).toHaveLength(1);
  });

  it('treats a different key as a genuine second announcement', async () => {
    await register(await makeUser('snd-two'));
    await sendContestAnnouncement(db, input(), CTX);
    await sendContestAnnouncement(db, input({ subject: 'A second update' }), CTX);

    expect(await db.select().from(contestAnnouncements)).toHaveLength(2);
    expect(await db.select().from(emailOutbox)).toHaveLength(2);
  });

  it('sends to nobody, and records nothing, when the audience is empty', async () => {
    const res = await sendContestAnnouncement(db, input(), CTX);
    expect(res.recipientCount).toBe(0);
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
    const [row] = await db.select().from(contestAnnouncements);
    expect(row).toMatchObject({ recipientCount: 0, status: 'sent' });
  });

  it('handles an audience larger than one enqueue chunk', async () => {
    for (let i = 0; i < 12; i++) await register(await makeUser(`snd-bulk-${i}`));
    const res = await sendContestAnnouncement(db, input(), CTX, 5);
    expect(res.recipientCount).toBe(12);
    expect(await db.select().from(emailOutbox)).toHaveLength(12);
    expect(await db.select().from(contestAnnouncementSends)).toHaveLength(12);
  });

  // CLAIM-FIRST, tested where it is actually observable.
  //
  // The send mails the rows the ledger CLAIMED, not the rows the audience
  // resolved. v1's single selector cannot resolve the same person twice
  // (contest_registrations is UNIQUE on contest+user), so that distinction has no
  // reachable failure path through sendContestAnnouncement -- which is exactly how
  // a guard ends up decorative and nobody notices. Test the claim directly, with
  // the duplicate input the planned audience UNION will produce.
  describe('claimAnnouncementRecipients', () => {
    async function announcement(): Promise<string> {
      const [row] = await db
        .insert(contestAnnouncements)
        .values({
          contestId, idempotencyKey: crypto.randomUUID(), subject: 'claim',
          bodyBlocks: BODY, audience: { kind: 'registrants', tier: 'all' }, sentById: organizerId,
        })
        .returning({ id: contestAnnouncements.id });
      return row!.id;
    }

    it('returns everyone on a first claim, and nobody on a second', async () => {
      const id = await announcement();
      const people = [{ userId: await makeUser('clm-a') }, { userId: await makeUser('clm-b') }];

      expect((await claimAnnouncementRecipients(db, id, people)).map((r) => r.userId)).toEqual(people.map((p) => p.userId));
      expect(await claimAnnouncementRecipients(db, id, people)).toEqual([]);
      expect(await db.select().from(contestAnnouncementSends)).toHaveLength(2);
    });

    // The union case: someone who is both a registrant and a judge resolves twice.
    it('returns a duplicated recipient exactly once', async () => {
      const id = await announcement();
      const u = await makeUser('clm-dup');
      const claimed = await claimAnnouncementRecipients(db, id, [{ userId: u }, { userId: u }]);
      expect(claimed).toHaveLength(1);
      expect(await db.select().from(contestAnnouncementSends)).toHaveLength(1);
    });

    it('drops only the already-claimed ones from a mixed batch', async () => {
      const id = await announcement();
      const old1 = await makeUser('clm-old');
      const fresh = await makeUser('clm-new');
      await claimAnnouncementRecipients(db, id, [{ userId: old1 }]);

      const claimed = await claimAnnouncementRecipients(db, id, [{ userId: old1 }, { userId: fresh }]);
      expect(claimed.map((r) => r.userId)).toEqual([fresh]);
    });

    it('preserves input order across chunk boundaries', async () => {
      const id = await announcement();
      const ids: string[] = [];
      for (let i = 0; i < 7; i++) ids.push(await makeUser(`clm-ord-${i}`));
      const claimed = await claimAnnouncementRecipients(db, id, ids.map((userId) => ({ userId })), 3);
      expect(claimed.map((r) => r.userId)).toEqual(ids);
    });

    it('is a no-op for an empty audience', async () => {
      expect(await claimAnnouncementRecipients(db, await announcement(), [])).toEqual([]);
      expect(await db.select().from(contestAnnouncementSends)).toHaveLength(0);
    });
  });

  it('a repeated send under the same key claims nobody twice', async () => {
    await register(await makeUser('snd-dedupe'));
    const key = crypto.randomUUID();
    const first = await sendContestAnnouncement(db, input({ idempotencyKey: key }), CTX);
    expect(first.recipientCount).toBe(1);
    const again = await sendContestAnnouncement(db, input({ idempotencyKey: key }), CTX);
    expect(again.duplicate).toBe(true);
    expect(await db.select().from(contestAnnouncementSends)).toHaveLength(1);
    expect(await db.select().from(emailOutbox)).toHaveLength(1);
  });

  describe('the abuse bound', () => {
    it('refuses once the contest has sent its allowance in the window', async () => {
      await register(await makeUser('snd-rate'));
      for (let i = 0; i < 2; i++) {
        await sendContestAnnouncement(db, input({ maxPerWindow: 2, subject: `n${i}` }), CTX);
      }
      await expect(sendContestAnnouncement(db, input({ maxPerWindow: 2, subject: 'over' }), CTX))
        .rejects.toBeInstanceOf(AnnouncementRateLimitError);
      expect(await db.select().from(contestAnnouncements)).toHaveLength(2);
    });

    // Ordering matters: a client retrying a send that already went out is not
    // asking for new work, so it must get its result back, not a rate-limit
    // error for an allowance it is not consuming.
    it('lets a retry of an ALREADY-SENT announcement through even at the limit', async () => {
      await register(await makeUser('snd-rate-retry'));
      const key = crypto.randomUUID();
      const first = await sendContestAnnouncement(db, input({ maxPerWindow: 2, idempotencyKey: key }), CTX);
      await sendContestAnnouncement(db, input({ maxPerWindow: 2, subject: 'second' }), CTX);

      // At the limit now. A NEW announcement is refused...
      await expect(sendContestAnnouncement(db, input({ maxPerWindow: 2, subject: 'third' }), CTX))
        .rejects.toBeInstanceOf(AnnouncementRateLimitError);
      // ...but the retry of the first returns its result.
      const retry = await sendContestAnnouncement(db, input({ maxPerWindow: 2, idempotencyKey: key }), CTX);
      expect(retry.duplicate).toBe(true);
      expect(retry.announcementId).toBe(first.announcementId);
    });

    it('does not bound anything when no allowance is supplied', async () => {
      await register(await makeUser('snd-unbounded'));
      for (let i = 0; i < 4; i++) await sendContestAnnouncement(db, input({ subject: `u${i}` }), CTX);
      expect(await db.select().from(contestAnnouncements)).toHaveLength(4);
    });
  });

  describe('tokens', () => {
    it('resolves {deadline} and {timeRemaining} from the contest dates', async () => {
      await register(await makeUser('snd-deadline'));
      const soon = new Date(Date.now() + 36 * 60 * 60 * 1000);
      await sendContestAnnouncement(
        db,
        input({
          contest: contestRow({ endDate: soon }),
          bodyBlocks: [['paragraph', { text: 'Closes {deadline}, about {timeRemaining} left.' }]],
        }),
        CTX,
      );
      const [m] = await db.select().from(emailOutbox);
      expect(m!.html).toMatch(/Closes \w+ \d+, \d{4} at \d{2}:\d{2} UTC/);
      expect(m!.html).toContain('36 hours left');
    });

    // A passed deadline must render EMPTY rather than a stale date, so a late
    // announcement never tells a participant they have time they do not have.
    it('renders {deadline} and {timeRemaining} empty once the deadline has passed', async () => {
      await register(await makeUser('snd-past'));
      const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await sendContestAnnouncement(
        db,
        input({
          contest: contestRow({ endDate: past }),
          bodyBlocks: [['paragraph', { text: 'Deadline:[{deadline}] Left:[{timeRemaining}]' }]],
        }),
        CTX,
      );
      const [m] = await db.select().from(emailOutbox);
      expect(m!.html).toContain('Deadline:[] Left:[]');
    });

    it('uses {displayName} when set, and falls back to the username when it is not', async () => {
      const named = await makeUser('snd-named');
      const anon = await makeUser('snd-anon');
      await db.update(users).set({ displayName: 'Ada Lovelace' }).where(eq(users.id, named));
      // createTestUser defaults displayName to 'Test User', so the fallback is
      // only exercised by explicitly clearing it.
      await db.update(users).set({ displayName: null }).where(eq(users.id, anon));
      await register(named);
      await register(anon);

      await sendContestAnnouncement(
        db, input({ bodyBlocks: [['paragraph', { text: 'Hello {displayName}.' }]] }), CTX,
      );
      const rows = await db.select().from(emailOutbox);
      const forNamed = rows.find((m) => m.toEmail === 'snd-named@example.com')!;
      const forAnon = rows.find((m) => m.toEmail === 'snd-anon@example.com')!;
      expect(forNamed.html).toContain('Hello Ada Lovelace.');
      expect(forAnon.html).toContain('Hello snd-anon.');
    });
  });

  describe('listContestAnnouncements', () => {
    it('returns this contest history newest first, and never another contest', async () => {
      await register(await makeUser('snd-hist'));
      await sendContestAnnouncement(db, input({ subject: 'First' }), CTX);
      await sendContestAnnouncement(db, input({ subject: 'Second' }), CTX);

      const [other] = await db
        .insert(contests)
        .values({
          title: 'Other', slug: `oth-${crypto.randomUUID().slice(0, 8)}`,
          startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'),
          status: 'active', createdById: organizerId,
        })
        .returning({ id: contests.id });
      await sendContestAnnouncement(db, input({ contestId: other!.id, subject: 'Elsewhere' }), CTX);

      const rows = await listContestAnnouncements(db, contestId);
      expect(rows.map((r) => r.subject)).toEqual(['Second', 'First']);
    });

    // The history is organizer-facing UI. It must carry the audit facts and NOT
    // the recipient list: addresses never travel back to the organizer.
    it('carries who sent it and how many it reached, and no recipient addresses', async () => {
      await register(await makeUser('snd-audit'));
      await sendContestAnnouncement(db, input({ subject: 'Audited' }), CTX);

      const [row] = await listContestAnnouncements(db, contestId);
      expect(row).toMatchObject({ subject: 'Audited', recipientCount: 1, status: 'sent' });
      expect(JSON.stringify(row)).not.toContain('@example.com');
    });
  });
});
