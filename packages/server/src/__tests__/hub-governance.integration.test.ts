import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { hubMembers } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub } from '../hub/hub.js';
import { joinHub, changeRole, transferOwnership } from '../hub/members.js';
import { createHubFlag, listHubFlags, resolveHubFlag } from '../hub/flags.js';

async function roleOf(db: DB, hubId: string, userId: string): Promise<string | null> {
  const [r] = await db.select({ role: hubMembers.role }).from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
  return r?.role ?? null;
}

describe('hub governance — transfer ownership + steward flags', () => {
  let db: DB;
  let ownerId: string, memberId: string, stewardId: string, outsiderId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'gov-owner' })).id;
    memberId = (await createTestUser(db, { username: 'gov-member' })).id;
    stewardId = (await createTestUser(db, { username: 'gov-steward' })).id;
    outsiderId = (await createTestUser(db, { username: 'gov-outsider' })).id;
  });

  afterAll(async () => { await closeTestDB(db); });

  async function freshHub(name: string): Promise<string> {
    const hubId = (await createHub(db, ownerId, { name, hubType: 'community' })).id;
    await joinHub(db, memberId, hubId);
    await joinHub(db, stewardId, hubId);
    await changeRole(db, ownerId, hubId, stewardId, 'steward');
    return hubId;
  }

  // --- Transfer ownership ---

  it('owner transfers ownership: target becomes owner, former owner becomes admin', async () => {
    const hubId = await freshHub('Transfer A');
    const res = await transferOwnership(db, ownerId, hubId, memberId);
    expect(res.transferred).toBe(true);
    expect(await roleOf(db, hubId, memberId)).toBe('owner');
    expect(await roleOf(db, hubId, ownerId)).toBe('admin');
  });

  it('non-owner cannot transfer ownership', async () => {
    const hubId = await freshHub('Transfer B');
    const res = await transferOwnership(db, stewardId, hubId, memberId);
    expect(res.transferred).toBe(false);
    expect(await roleOf(db, hubId, ownerId)).toBe('owner'); // unchanged
  });

  it('cannot transfer to a non-member', async () => {
    const hubId = await freshHub('Transfer C');
    const res = await transferOwnership(db, ownerId, hubId, outsiderId);
    expect(res.transferred).toBe(false);
    expect(await roleOf(db, hubId, ownerId)).toBe('owner');
  });

  it('cannot transfer to yourself', async () => {
    const hubId = await freshHub('Transfer D');
    const res = await transferOwnership(db, ownerId, hubId, ownerId);
    expect(res.transferred).toBe(false);
    expect(await roleOf(db, hubId, ownerId)).toBe('owner');
  });

  // --- Steward role assignment ---

  it('owner can grant + revoke the steward role; steward cannot be promoted to owner', async () => {
    const hubId = await freshHub('Steward grant');
    expect(await roleOf(db, hubId, stewardId)).toBe('steward');
    // steward -> owner is refused by changeRole
    const bad = await changeRole(db, ownerId, hubId, stewardId, 'owner' as never);
    expect(bad.changed).toBe(false);
    // revoke back to member
    await changeRole(db, ownerId, hubId, stewardId, 'member');
    expect(await roleOf(db, hubId, stewardId)).toBe('member');
  });

  // --- Steward flags (member target) ---

  it('a steward can flag a member; a plain member cannot', async () => {
    const hubId = await freshHub('Flag member');
    const ok = await createHubFlag(db, stewardId, hubId, { targetType: 'member', targetId: memberId, reason: 'spam' });
    expect(ok.flagged).toBe(true);

    const denied = await createHubFlag(db, memberId, hubId, { targetType: 'member', targetId: stewardId });
    expect(denied.flagged).toBe(false);
    expect(denied.error).toMatch(/permission/i);
  });

  it('cannot flag the owner, or a non-member', async () => {
    const hubId = await freshHub('Flag guards');
    expect((await createHubFlag(db, stewardId, hubId, { targetType: 'member', targetId: ownerId })).flagged).toBe(false);
    expect((await createHubFlag(db, stewardId, hubId, { targetType: 'member', targetId: outsiderId })).flagged).toBe(false);
  });

  it('flagging a project that is not shared to the hub is rejected', async () => {
    const hubId = await freshHub('Flag project guard');
    const res = await createHubFlag(db, stewardId, hubId, { targetType: 'project', targetId: '00000000-0000-4000-8000-000000000000' });
    expect(res.flagged).toBe(false);
    expect(res.error).toMatch(/not shared/i);
  });

  it('re-flagging the same target reopens (upsert), never duplicates', async () => {
    const hubId = await freshHub('Flag reopen');
    await createHubFlag(db, stewardId, hubId, { targetType: 'member', targetId: memberId, reason: 'first' });
    // owner resolves it
    let queue = await listHubFlags(db, ownerId, hubId);
    const flagId = queue.items[0]!.id;
    await resolveHubFlag(db, ownerId, hubId, flagId, 'dismissed');
    // steward re-flags -> single row, back to open
    await createHubFlag(db, stewardId, hubId, { targetType: 'member', targetId: memberId, reason: 'again' });
    queue = await listHubFlags(db, ownerId, hubId);
    expect(queue.items.length).toBe(1);
    expect(queue.items[0]!.status).toBe('open');
    expect(queue.items[0]!.reason).toBe('again');
  });

  // --- Review queue authz ---

  it('only owner/admin can list + resolve the flag queue', async () => {
    const hubId = await freshHub('Queue authz');
    await createHubFlag(db, stewardId, hubId, { targetType: 'member', targetId: memberId });

    // steward + member cannot review
    expect((await listHubFlags(db, stewardId, hubId)).error).toMatch(/permission/i);
    expect((await listHubFlags(db, memberId, hubId)).error).toMatch(/permission/i);

    // owner can
    const owned = await listHubFlags(db, ownerId, hubId);
    expect(owned.items.length).toBe(1);
    expect(owned.items[0]!.targetLabel).toBeTruthy();

    // steward cannot resolve
    const flagId = owned.items[0]!.id;
    expect((await resolveHubFlag(db, stewardId, hubId, flagId, 'dismissed')).resolved).toBe(false);
    // owner can, and it does NOT remove the member (advisory only)
    expect((await resolveHubFlag(db, ownerId, hubId, flagId, 'actioned')).resolved).toBe(true);
    expect(await roleOf(db, hubId, memberId)).toBe('member');
  });
});
