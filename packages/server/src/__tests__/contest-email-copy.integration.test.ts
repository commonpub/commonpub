import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { contests, contestRegistrations, emailOutbox, users } from '@commonpub/schema';
import type { ContestEmailCopy } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { registerForContest } from '../contest/registrations.js';
import { sweepContestReminders } from '../contest/reminders.js';
import { parseContestEmailCopy } from '../contest/emailCopy.js';
import { getContestBySlug } from '../contest/read.js';

// Per-contest email copy override (session 232). Verifies the override is applied
// to the REAL enqueued outbox message (subject + html), and only when the
// `contestEmailEditor` flag is on; with the flag off, sends use the built-in
// default copy. Exercises the full template output path, not a re-derivation.

const EMAIL = { siteUrl: 'https://test.example', siteName: 'Test', secret: 'copy-secret' };
const DAY = 24 * 60 * 60 * 1000;

function cfg(features: Partial<CommonPubConfig['features']>): CommonPubConfig {
  return { features, instance: { domain: 'test.example', name: 'Test' } } as unknown as CommonPubConfig;
}

async function makeContest(db: DB, createdById: string, endDate: Date, emailCopy: ContestEmailCopy | null): Promise<string> {
  const [row] = await db
    .insert(contests)
    .values({
      title: 'Override Cup',
      slug: `oc-${crypto.randomUUID().slice(0, 8)}`,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate,
      status: 'active',
      createdById,
      emailCopy,
    })
    .returning({ id: contests.id });
  return row!.id;
}

describe('parseContestEmailCopy', () => {
  it('returns {} for null/invalid input', () => {
    expect(parseContestEmailCopy(null)).toEqual({});
    expect(parseContestEmailCopy(undefined)).toEqual({});
    expect(parseContestEmailCopy({ confirmation: { subject: 123 } })).toEqual({});
    expect(parseContestEmailCopy({ evil: true })).toEqual({});
  });

  it('returns the validated override for a valid value', () => {
    const v = parseContestEmailCopy({ confirmation: { subject: 'Hi {contestTitle}' } });
    expect(v.confirmation?.subject).toBe('Hi {contestTitle}');
  });
});

describe('per-contest email copy application', () => {
  let db: DB;
  let organizerId: string;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'copy-organizer' })).id;
    const u = await createTestUser(db, { username: 'copy-participant', email: 'copy@example.com' });
    userId = u.id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(emailOutbox);
    await db.delete(contestRegistrations);
  });

  const OVERRIDE: ContestEmailCopy = {
    confirmation: { subject: 'Welcome to {contestTitle}, {username}', intro: 'Hey {username}, thanks for joining {contestTitle}.' },
    reminder: { subject: '{timeRemaining} to go for {contestTitle}', intro: 'Only {timeRemaining} remain, {username}.' },
  };

  it('registration confirmation uses the override when the flag is ON', async () => {
    const contestId = await makeContest(db, organizerId, new Date('2026-12-01T00:00:00Z'), OVERRIDE);
    await registerForContest(db, cfg({ emailNotifications: true, contestEmailEditor: true }), { contestId, userId }, EMAIL);
    const [mail] = await db.select().from(emailOutbox);
    expect(mail).toBeTruthy();
    expect(mail!.subject).toBe('Welcome to Override Cup, copy-participant');
    expect(mail!.html).toContain('Hey copy-participant, thanks for joining Override Cup.');
    expect(mail!.html).not.toContain('You are now registered for'); // default lead replaced
  });

  it('registration confirmation falls back to the default when the flag is OFF', async () => {
    const contestId = await makeContest(db, organizerId, new Date('2026-12-01T00:00:00Z'), OVERRIDE);
    await registerForContest(db, cfg({ emailNotifications: true, contestEmailEditor: false }), { contestId, userId }, EMAIL);
    const [mail] = await db.select().from(emailOutbox);
    expect(mail).toBeTruthy();
    expect(mail!.subject).toContain('You are registered for Override Cup');
    expect(mail!.html).toContain('You are now registered for');
    expect(mail!.html).not.toContain('thanks for joining');
  });

  it('a contest with no override always sends the default', async () => {
    const contestId = await makeContest(db, organizerId, new Date('2026-12-01T00:00:00Z'), null);
    await registerForContest(db, cfg({ emailNotifications: true, contestEmailEditor: true }), { contestId, userId }, EMAIL);
    const [mail] = await db.select().from(emailOutbox);
    expect(mail!.subject).toContain('You are registered for Override Cup');
    expect(mail!.html).toContain('You are now registered for');
  });

  it('deadline reminder uses the override when the flag is ON', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    // 5 days out ⇒ only the 7-day milestone fires (one email).
    const contestId = await makeContest(db, organizerId, new Date(now.getTime() + 5 * DAY), OVERRIDE);
    await db.insert(contestRegistrations).values({ contestId, userId });
    const res = await sweepContestReminders(db, cfg({ emailNotifications: true, contestReminders: true, contestEmailEditor: true }), { ...EMAIL, now });
    expect(res.enqueued).toBe(1);
    const [mail] = await db.select().from(emailOutbox);
    // `{timeRemaining}` resolves to the ACTUAL time left (5 days out), not the
    // milestone's nominal name.
    expect(mail!.subject).toBe('5 days to go for Override Cup');
    expect(mail!.html).toContain('Only 5 days remain, copy-participant.');
    expect(mail!.html).toContain('Submissions close on'); // system deadline line kept
  });

  it('does NOT leak emailCopy in the public contest DTO', async () => {
    const contestId = await makeContest(db, organizerId, new Date('2026-12-01T00:00:00Z'), OVERRIDE);
    const [row] = await db.select({ slug: contests.slug }).from(contests).where(eq(contests.id, contestId));
    const detail = await getContestBySlug(db, row!.slug);
    expect(detail).toBeTruthy();
    expect(detail as Record<string, unknown>).not.toHaveProperty('emailCopy');
  });

  it('deadline reminder falls back to default when the flag is OFF', async () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const contestId = await makeContest(db, organizerId, new Date(now.getTime() + 5 * DAY), OVERRIDE);
    await db.insert(contestRegistrations).values({ contestId, userId });
    await sweepContestReminders(db, cfg({ emailNotifications: true, contestReminders: true, contestEmailEditor: false }), { ...EMAIL, now });
    const [mail] = await db.select().from(emailOutbox);
    expect(mail!.subject).toContain('5 days left to submit: Override Cup');
    expect(mail!.html).not.toContain('Only 5 days remain');
  });
});
