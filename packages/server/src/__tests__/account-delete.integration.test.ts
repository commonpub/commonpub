/**
 * Deleting an account (session 262, audit N12 / N13 / P1-5).
 *
 * Before: contests, hubs, docs sites, events, learning paths and products were
 * `ON DELETE CASCADE` on their creator, so an organizer deleting their own
 * account deleted the live contest and every entrant's entry with it. Deleting a
 * moderator lifted every ban they had issued, and deleting anyone erased their
 * audit trail. Self-delete also wrote its audit row AFTER the user was gone, so
 * it failed on the foreign key after the delete had committed.
 *
 * Now: an account that still owns something other people use cannot be deleted
 * until it is handed over or removed, and says what; bans and audit entries
 * outlive the person who made them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { users, contests, auditLogs, hubBans, hubs } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContest } from '../contest/index.js';
import { createHub } from '../hub/hub.js';
import { joinHub, transferOwnership } from '../hub/members.js';
import { banUser, listBans } from '../hub/moderation.js';
import { deleteUser, listAuditLogs, AccountOwnsSharedContentError, findSharedOwnership } from '../admin/admin.js';

let db: DB;
const DAY = 86_400_000;
const iso = (t: number): string => new Date(t).toISOString();
const uniq = (s: string): string => `${s}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
  db = await createTestDB();
}, 120_000);
afterAll(async () => {
  await closeTestDB(db);
});

const exists = async (id: string): Promise<boolean> =>
  (await db.select({ id: users.id }).from(users).where(eq(users.id, id))).length > 0;

describe('an account that owns shared things', () => {
  it('cannot be deleted while it owns a contest, and the contest and the account survive', async () => {
    const organizer = await createTestUser(db, { username: uniq('organizer') });
    const contest = await createContest(db, {
      title: uniq('Live contest'),
      slug: uniq('live'),
      description: 'x',
      startDate: iso(Date.now() - DAY),
      endDate: iso(Date.now() + 30 * DAY),
      createdBy: organizer.id,
    });

    const err = await deleteUser(db, organizer.id, organizer.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AccountOwnsSharedContentError);
    expect((err as AccountOwnsSharedContentError).owned.contests).toBe(1);
    expect(await exists(organizer.id)).toBe(true);
    expect((await db.select().from(contests).where(eq(contests.id, contest.id))).length).toBe(1);
  });

  it('reports every kind it owns', async () => {
    const owner = await createTestUser(db, { username: uniq('owner') });
    await createHub(db, owner.id, { name: uniq('Hub'), hubType: 'community' });
    const owned = await findSharedOwnership(db, owner.id);
    expect(owned).toEqual({ contests: 0, hubs: 1, docsSites: 0, events: 0, learningPaths: 0, products: 0 });
    await expect(deleteUser(db, owner.id, owner.id)).rejects.toBeInstanceOf(AccountOwnsSharedContentError);
  });

  it('the database refuses the cascade even if a caller skips the check', async () => {
    const organizer = await createTestUser(db, { username: uniq('direct') });
    const contest = await createContest(db, {
      title: uniq('Guarded'),
      slug: uniq('guarded'),
      description: 'x',
      startDate: iso(Date.now() - DAY),
      endDate: iso(Date.now() + 30 * DAY),
      createdBy: organizer.id,
    });
    await expect(db.delete(users).where(eq(users.id, organizer.id))).rejects.toThrow();
    expect((await db.select().from(contests).where(eq(contests.id, contest.id))).length).toBe(1);
  });
});

describe('hubs that are no longer theirs', () => {
  it('a hub handed over does not block, and its creator of record becomes the current owner', async () => {
    const founder = await createTestUser(db, { username: uniq('founder') });
    const successor = await createTestUser(db, { username: uniq('successor') });
    const hub = await createHub(db, founder.id, { name: uniq('Handed over'), hubType: 'community' });
    await joinHub(db, successor.id, hub.id);
    expect((await transferOwnership(db, founder.id, hub.id, successor.id)).transferred).toBe(true);

    expect((await findSharedOwnership(db, founder.id)).hubs).toBe(0);
    await deleteUser(db, founder.id, founder.id);
    const [row] = await db.select({ createdById: hubs.createdById }).from(hubs).where(eq(hubs.id, hub.id));
    expect(row!.createdById).toBe(successor.id);
  });

  it('a hub already deleted does not block, and is removed with the account', async () => {
    const owner = await createTestUser(db, { username: uniq('closed') });
    const hub = await createHub(db, owner.id, { name: uniq('Closed'), hubType: 'community' });
    await db.update(hubs).set({ deletedAt: new Date() }).where(eq(hubs.id, hub.id));
    expect((await findSharedOwnership(db, owner.id)).hubs).toBe(0);
    await deleteUser(db, owner.id, owner.id);
    expect((await db.select().from(hubs).where(eq(hubs.id, hub.id))).length).toBe(0);
  });
});

describe('an account that owns nothing shared', () => {
  it('self-delete succeeds and leaves an audit entry with the actor cleared', async () => {
    const member = await createTestUser(db, { username: uniq('leaver') });
    await deleteUser(db, member.id, member.id);
    expect(await exists(member.id)).toBe(false);

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.targetId, member.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('user.deleted');
    expect(rows[0]!.userId).toBeNull();
    expect((rows[0]!.metadata as { username: string }).username).toBe(member.username);
  });

  it('an admin delete records the admin as the actor', async () => {
    const admin = await createTestUser(db, { username: uniq('admin') });
    const member = await createTestUser(db, { username: uniq('removed') });
    await deleteUser(db, member.id, admin.id);
    const [row] = await db.select().from(auditLogs).where(eq(auditLogs.targetId, member.id));
    expect(row!.userId).toBe(admin.id);
  });
});

describe('what outlives the person who made it', () => {
  it("a moderator's bans and audit entries survive their account being deleted", async () => {
    const owner = await createTestUser(db, { username: uniq('hubowner') });
    const moderator = await createTestUser(db, { username: uniq('mod') });
    const troll = await createTestUser(db, { username: uniq('troll') });
    const hub = await createHub(db, owner.id, { name: uniq('Banned here'), hubType: 'community' });
    await joinHub(db, troll.id, hub.id);
    // The owner bans; then the owner's admin hands the hub over and leaves.
    expect((await banUser(db, owner.id, hub.id, troll.id, 'spam')).banned).toBe(true);
    await db.insert(auditLogs).values({ userId: moderator.id, action: 'test.action', targetType: 'user', targetId: troll.id });

    // Simulate the banning account going away without touching the hub it owns.
    await db.update(hubBans).set({ bannedById: moderator.id }).where(eq(hubBans.hubId, hub.id));
    await deleteUser(db, moderator.id, moderator.id);

    const bans = await listBans(db, hub.id);
    expect(bans).toHaveLength(1);
    expect(bans[0]!.user.id).toBe(troll.id);
    expect(bans[0]!.bannedBy).toBeNull();

    const log = await listAuditLogs(db, { action: 'test.action' });
    expect(log.items).toHaveLength(1);
    expect(log.items[0]!.user).toBeNull();
  });
});
