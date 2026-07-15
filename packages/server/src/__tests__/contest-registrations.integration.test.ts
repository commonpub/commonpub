import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { contests, contestRegistrations, emailOutbox, users } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  registerForContest,
  unregisterForContest,
  isRegisteredForContest,
  getViewerRegistration,
  listContestRegistrants,
  getRegistrantCount,
} from '../contest/registrations.js';
import { verifyUnsubscribeToken } from '../comms/unsubscribe.js';

// Contest registration (participant sign-up) + the transactional confirmation
// email. Registration is the new audience concept: no attached content required.

const EMAIL = { siteUrl: 'https://test.example', siteName: 'Test', secret: 'reg-secret' };

function cfg(features: Partial<CommonPubConfig['features']>): CommonPubConfig {
  return { features, instance: { domain: 'test.example', name: 'Test' } } as unknown as CommonPubConfig;
}

async function makeContest(
  db: DB,
  createdById: string,
  over: Partial<{ status: string; endDate: Date; slug: string; title: string }> = {},
): Promise<string> {
  const [row] = await db
    .insert(contests)
    .values({
      title: over.title ?? 'Qualcomm Hackathon',
      slug: over.slug ?? `qc-${crypto.randomUUID().slice(0, 8)}`,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: over.endDate ?? new Date('2026-12-01T00:00:00Z'),
      status: (over.status ?? 'active') as 'active',
      createdById,
    })
    .returning({ id: contests.id });
  return row!.id;
}

describe('contest registrations', () => {
  let db: DB;
  let organizerId: string;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'reg-organizer' })).id;
    const u = await createTestUser(db, { username: 'reg-participant', email: 'p@example.com' });
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

  it('registers a user and reports registered', async () => {
    const contestId = await makeContest(db, organizerId);
    const res = await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    expect(res).toEqual({ registered: true, alreadyRegistered: false, tier: 'full' });

    const rows = await db.select().from(contestRegistrations).where(eq(contestRegistrations.contestId, contestId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(userId);
    expect(await isRegisteredForContest(db, contestId, userId)).toBe(true);
  });

  it('is idempotent: a second register does not duplicate or re-report', async () => {
    const contestId = await makeContest(db, organizerId);
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    const second = await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    expect(second).toEqual({ registered: false, alreadyRegistered: true, tier: 'full' });

    const rows = await db.select().from(contestRegistrations).where(eq(contestRegistrations.contestId, contestId));
    expect(rows).toHaveLength(1);
  });

  it('rejects registration for a non-open contest', async () => {
    const contestId = await makeContest(db, organizerId, { status: 'completed' });
    const res = await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    expect(res.registered).toBe(false);
    expect(res.error).toMatch(/not open/i);
    expect(await getRegistrantCount(db, contestId)).toBe(0);
  });

  it('rejects registration for a missing contest', async () => {
    const res = await registerForContest(db, cfg({ emailNotifications: false }), {
      contestId: crypto.randomUUID(),
      userId,
    });
    expect(res.registered).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  it('enqueues a confirmation email when emailNotifications on + verified + email ctx', async () => {
    const contestId = await makeContest(db, organizerId, { title: 'TinyML Cup' });
    const res = await registerForContest(db, cfg({ emailNotifications: true }), { contestId, userId }, EMAIL);
    expect(res.registered).toBe(true);

    const mail = await db.select().from(emailOutbox);
    expect(mail).toHaveLength(1);
    const m = mail[0]!;
    expect(m.toEmail).toBe('p@example.com');
    expect(m.userId).toBe(userId);
    expect(m.category).toBe('reminder');
    expect(m.subject).toContain('TinyML Cup');
    // Carries a per-recipient one-click unsubscribe header with a valid token.
    const hdr = (m.headers as Record<string, string>)['List-Unsubscribe']!;
    const token = hdr.match(/token=([^>]+)/)![1]!;
    expect(verifyUnsubscribeToken(token, EMAIL.secret)).toBe(userId);
  });

  it('does not email when emailNotifications is off', async () => {
    const contestId = await makeContest(db, organizerId);
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId }, EMAIL);
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('does not email an unverified address', async () => {
    const unverified = await createTestUser(db, { username: 'reg-unverified' });
    const contestId = await makeContest(db, organizerId);
    const res = await registerForContest(
      db,
      cfg({ emailNotifications: true }),
      { contestId, userId: unverified.id },
      EMAIL,
    );
    expect(res.registered).toBe(true); // registration still succeeds
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('does not email a verified user who globally unsubscribed', async () => {
    const optedOut = await createTestUser(db, { username: 'reg-optout', email: 'optout@example.com' });
    await db
      .update(users)
      .set({ emailVerified: true, emailNotifications: { unsubscribedAll: true } })
      .where(eq(users.id, optedOut.id));
    const contestId = await makeContest(db, organizerId);
    const res = await registerForContest(
      db,
      cfg({ emailNotifications: true }),
      { contestId, userId: optedOut.id },
      EMAIL,
    );
    expect(res.registered).toBe(true); // registration still succeeds
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
  });

  it('does not email on an idempotent re-register (only the first send)', async () => {
    const contestId = await makeContest(db, organizerId);
    await registerForContest(db, cfg({ emailNotifications: true }), { contestId, userId }, EMAIL);
    await registerForContest(db, cfg({ emailNotifications: true }), { contestId, userId }, EMAIL);
    expect(await db.select().from(emailOutbox)).toHaveLength(1);
  });

  it('unregister removes the row and reflects in isRegistered', async () => {
    const contestId = await makeContest(db, organizerId);
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    const gone = await unregisterForContest(db, contestId, userId);
    expect(gone.unregistered).toBe(true);
    expect(await isRegisteredForContest(db, contestId, userId)).toBe(false);
    // Second unregister is a no-op.
    expect((await unregisterForContest(db, contestId, userId)).unregistered).toBe(false);
  });

  it('lists registrants and counts them', async () => {
    const contestId = await makeContest(db, organizerId);
    const u2 = await createTestUser(db, { username: 'reg-second' });
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId: u2.id });

    expect(await getRegistrantCount(db, contestId)).toBe(2);
    const list = await listContestRegistrants(db, contestId);
    expect(list.total).toBe(2);
    expect(list.items.map((i) => i.userId).sort()).toEqual([userId, u2.id].sort());
    expect(list.items[0]).toHaveProperty('username');
    expect(list.items[0]).toHaveProperty('registeredAt');
  });

  // --- Two-tier signup (session 239) ---

  it('a reminders-only signup is NOT counted as a participant, but is registered', async () => {
    const contestId = await makeContest(db, organizerId);
    const res = await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId, tier: 'reminders' });
    expect(res).toEqual({ registered: true, alreadyRegistered: false, tier: 'reminders' });
    // Excluded from the participant count + list, but a registration row exists.
    expect(await getRegistrantCount(db, contestId)).toBe(0);
    expect((await listContestRegistrants(db, contestId)).total).toBe(0);
    expect(await isRegisteredForContest(db, contestId, userId)).toBe(true);
    expect(await getViewerRegistration(db, contestId, userId)).toMatchObject({ tier: 'reminders' });
  });

  it('re-registering reminders→full UPGRADES the tier (never downgrades)', async () => {
    const contestId = await makeContest(db, organizerId);
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId, tier: 'reminders' });
    // Upgrade to full.
    const up = await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId, tier: 'full' });
    expect(up.tier).toBe('full');
    expect(await getRegistrantCount(db, contestId)).toBe(1);
    // A subsequent reminders call does NOT downgrade a full participant.
    const back = await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId, tier: 'reminders' });
    expect(back.tier).toBe('full');
    expect(await getRegistrantCount(db, contestId)).toBe(1);
  });

  it('persists + updates optional signup fields, exposed via viewer + list', async () => {
    const contestId = await makeContest(db, organizerId);
    await registerForContest(db, cfg({ emailNotifications: false }), {
      contestId, userId, fields: { building: 'A soil sensor', experience: 'some', team: 'looking' },
    });
    expect(await getViewerRegistration(db, contestId, userId)).toEqual({
      tier: 'full',
      fields: { building: 'A soil sensor', experience: 'some', team: 'looking' },
    });
    // The organizer's registrant list carries the collected info.
    const list = await listContestRegistrants(db, contestId);
    expect(list.items[0]!.fields).toMatchObject({ building: 'A soil sensor', team: 'looking' });

    // An info-only re-register updates the fields; a bare re-register keeps them.
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId, fields: { building: 'A weather station' } });
    expect((await getViewerRegistration(db, contestId, userId))!.fields).toEqual({ building: 'A weather station' });
    await registerForContest(db, cfg({ emailNotifications: false }), { contestId, userId });
    expect((await getViewerRegistration(db, contestId, userId))!.fields).toEqual({ building: 'A weather station' });
  });

  it('getViewerRegistration returns null when not registered', async () => {
    const contestId = await makeContest(db, organizerId);
    expect(await getViewerRegistration(db, contestId, userId)).toBeNull();
  });
});
