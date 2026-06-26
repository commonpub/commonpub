import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { hubs, hubMembers, hubBans, users, referralLinks, referralAttributions } from '@commonpub/schema';
import type { DB } from '../../types.js';
import { createTestDB, createTestUser, closeTestDB } from '../../__tests__/helpers/testdb.js';
import {
  createReferralLink,
  listMyReferralLinks,
  getReferralLink,
  updateReferralLink,
  deleteReferralLink,
  claimReferral,
  resolveReferral,
  recordReferralClick,
} from '../index.js';

const DAY = 24 * 60 * 60 * 1000;

async function makeHub(
  db: DB,
  createdById: string,
  opts: { slug: string; name?: string; joinPolicy?: 'open' | 'approval' | 'invite'; privacy?: 'public' | 'unlisted' | 'private' },
): Promise<string> {
  const [hub] = await db.insert(hubs).values({
    name: opts.name ?? opts.slug, slug: opts.slug, description: 'A test hub', createdById,
    joinPolicy: opts.joinPolicy ?? 'open', privacy: opts.privacy ?? 'public',
  }).returning();
  return hub!.id;
}

/** Insert a user with an explicit createdAt (for the new-user guard tests). */
async function userAged(db: DB, username: string, createdAt: Date): Promise<string> {
  const id = crypto.randomUUID();
  const [u] = await db.insert(users).values({
    id, email: `${username}@example.com`, username, displayName: username, role: 'member', createdAt,
  }).returning();
  return u!.id;
}

describe('referral links — create / list / update / delete', () => {
  let db: DB;
  let owner: string;
  let openHubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    owner = (await createTestUser(db, { username: 'owner' })).id;
    const creator = (await createTestUser(db, { username: 'hubcreator' })).id;
    openHubId = await makeHub(db, creator, { slug: 'makers', name: 'Makers' });
  });
  afterAll(async () => { await closeTestDB(db); });

  it('auto-generates a unique 8-char code when none is given', async () => {
    const r = await createReferralLink(db, owner, { actions: [] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.link.code).toMatch(/^[2-9a-z]{8}$/);
      expect(r.link.ownerId).toBe(owner);
      expect(r.link.attributionWindowDays).toBe(60);
    }
  });

  it('accepts a custom code and rejects a duplicate', async () => {
    expect((await createReferralLink(db, owner, { code: 'join-me', actions: [] })).ok).toBe(true);
    const dup = await createReferralLink(db, owner, { code: 'join-me', actions: [] });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toMatch(/taken/i);
  });

  it('retries past a generated-code collision, and gives up after the cap', async () => {
    await createReferralLink(db, owner, { code: 'taken-a', actions: [] });
    await createReferralLink(db, owner, { code: 'taken-b', actions: [] });
    // First two generated codes collide; the third is free -> the loop recovers.
    const seq = ['taken-a', 'taken-b', 'freecode'];
    let i = 0;
    const r = await createReferralLink(db, owner, { actions: [] }, { genCode: () => seq[i++]! });
    expect(r.ok && r.link.code).toBe('freecode');
    // Every attempt collides -> exhaustion error (no infinite loop).
    const exhausted = await createReferralLink(db, owner, { actions: [] }, { genCode: () => 'taken-a' });
    expect(exhausted.ok).toBe(false);
    if (!exhausted.ok) expect(exhausted.error).toMatch(/unique code/i);
  });

  it('respects the default window override but a per-link value wins', async () => {
    expect((await createReferralLink(db, owner, { actions: [] }, { defaultWindowDays: 90 })).ok && true).toBe(true);
    const a = await createReferralLink(db, owner, { actions: [] }, { defaultWindowDays: 90 });
    expect(a.ok && a.link.attributionWindowDays).toBe(90);
    const b = await createReferralLink(db, owner, { actions: [], attributionWindowDays: 14 }, { defaultWindowDays: 90 });
    expect(b.ok && b.link.attributionWindowDays).toBe(14);
  });

  it('accepts join_hub for an open hub; rejects private / invite-only at creation', async () => {
    expect((await createReferralLink(db, owner, { actions: [{ type: 'join_hub', hubId: openHubId }] })).ok).toBe(true);
    const priv = await makeHub(db, owner, { slug: 'secret', privacy: 'private' });
    const inv = await makeHub(db, owner, { slug: 'club', joinPolicy: 'invite' });
    expect((await createReferralLink(db, owner, { actions: [{ type: 'join_hub', hubId: priv }] })).ok).toBe(false);
    expect((await createReferralLink(db, owner, { actions: [{ type: 'join_hub', hubId: inv }] })).ok).toBe(false);
  });

  it('orders the owner list newest-first (createdAt desc) deterministically', async () => {
    const u = (await createTestUser(db, { username: 'orderowner' })).id;
    // Insert with explicit, distinct createdAt so the ordering assertion is real.
    const base = Date.now();
    await db.insert(referralLinks).values([
      { ownerId: u, code: 'ord-old', actions: [], createdAt: new Date(base - 3000) },
      { ownerId: u, code: 'ord-new', actions: [], createdAt: new Date(base - 1000) },
      { ownerId: u, code: 'ord-mid', actions: [], createdAt: new Date(base - 2000) },
    ]);
    const list = await listMyReferralLinks(db, u);
    expect(list.map((l) => l.code)).toEqual(['ord-new', 'ord-mid', 'ord-old']);
  });

  it('scopes get/update/delete to the owner and re-validates actions on update', async () => {
    const other = (await createTestUser(db, { username: 'intruder' })).id;
    const mine = await createReferralLink(db, owner, { code: 'mine-1', actions: [] });
    const id = mine.ok ? mine.link.id : '';

    expect(await getReferralLink(db, other, id)).toBeNull();
    expect((await updateReferralLink(db, other, id, { label: 'hax' })).ok).toBe(false);
    expect(await deleteReferralLink(db, other, id)).toBe(false);

    // empty update -> no-op returns the existing row
    const noop = await updateReferralLink(db, owner, id, {});
    expect(noop.ok && noop.link.id).toBe(id);
    // action re-validation on update
    const privId = await makeHub(db, owner, { slug: 'secret2', privacy: 'private' });
    expect((await updateReferralLink(db, owner, id, { actions: [{ type: 'join_hub', hubId: privId }] })).ok).toBe(false);

    const upd = await updateReferralLink(db, owner, id, { label: 'My link', status: 'disabled' });
    expect(upd.ok && upd.link.status).toBe('disabled');
    expect(await deleteReferralLink(db, owner, id)).toBe(true);
  });
});

describe('referral attribution + new-user guard', () => {
  let db: DB;
  let owner: string;
  let hubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    owner = (await createTestUser(db, { username: 'owner' })).id;
    hubId = await makeHub(db, owner, { slug: 'makers', name: 'Makers' });
  });
  afterAll(async () => { await closeTestDB(db); });

  it('attributes a new signup, joins the hub, and returns the hub destination', async () => {
    await createReferralLink(db, owner, { code: 'grow', actions: [{ type: 'join_hub', hubId }] });
    const newUser = (await createTestUser(db, { username: 'recruit' })).id;
    const res = await claimReferral(db, { userId: newUser, code: 'GROW' });
    expect(res.attributed).toBe(true);
    expect(res.destination).toBe('/hubs/makers');
    const [attr] = await db.select().from(referralAttributions).where(eq(referralAttributions.referredUserId, newUser));
    expect(attr?.status).toBe('confirmed');
    const [l] = await db.select().from(referralLinks).where(eq(referralLinks.code, 'grow'));
    expect(l?.signupCount).toBe(1);
    const [m] = await db.select().from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, newUser)));
    expect(m?.status).toBe('active');
  });

  it('does NOT attribute an existing (old) account — only fresh signups', async () => {
    await createReferralLink(db, owner, { code: 'oldie', actions: [{ type: 'join_hub', hubId }] });
    const oldUser = await userAged(db, 'veteran', new Date(Date.now() - 400 * DAY));
    const res = await claimReferral(db, { userId: oldUser, code: 'oldie' });
    expect(res.attributed).toBe(false);
    expect(res.reason).toBe('not_new_user');
    // not auto-joined either
    const m = await db.select().from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, oldUser)));
    expect(m.length).toBe(0);
  });

  it('with a click time, attributes only if the account was created at/after the click', async () => {
    await createReferralLink(db, owner, { code: 'clickwin', actions: [] });
    // Signed up 2 days ago; clicked 3 days ago (account created after the click) -> attribute.
    const u1 = await userAged(db, 'after', new Date(Date.now() - 2 * DAY));
    const r1 = await claimReferral(db, { userId: u1, code: 'clickwin', clickedAt: new Date(Date.now() - 3 * DAY) });
    expect(r1.attributed).toBe(true);
    // Signed up 5 days ago; clicked today (account predates the click) -> reject.
    await createReferralLink(db, owner, { code: 'clicklose', actions: [] });
    const u2 = await userAged(db, 'before', new Date(Date.now() - 5 * DAY));
    const r2 = await claimReferral(db, { userId: u2, code: 'clicklose', clickedAt: new Date() });
    expect(r2.attributed).toBe(false);
    expect(r2.reason).toBe('not_new_user');
  });

  it('is idempotent AND keeps returning the correct destination on a repeat claim', async () => {
    await createReferralLink(db, owner, { code: 'again', actions: [{ type: 'join_hub', hubId }] });
    const u = (await createTestUser(db, { username: 'repeat' })).id;
    const first = await claimReferral(db, { userId: u, code: 'again' });
    expect(first.attributed).toBe(true);
    expect(first.destination).toBe('/hubs/makers');
    const second = await claimReferral(db, { userId: u, code: 'again' });
    expect(second.attributed).toBe(false);
    expect(second.reason).toBe('already_attributed');
    // The destination must NOT be dropped on the idempotent path (the backstop-race bug).
    expect(second.destination).toBe('/hubs/makers');
    const [l] = await db.select().from(referralLinks).where(eq(referralLinks.code, 'again'));
    expect(l?.signupCount).toBe(1);
  });

  it('first-touch: an already-attributed user keeps the FIRST link destination', async () => {
    const hub2 = await makeHub(db, owner, { slug: 'second-hub', name: 'Second' });
    await createReferralLink(db, owner, { code: 'firsttouch', actions: [{ type: 'join_hub', hubId }] });
    await createReferralLink(db, owner, { code: 'secondtouch', actions: [{ type: 'join_hub', hubId: hub2 }] });
    const u = (await createTestUser(db, { username: 'ft' })).id;
    expect((await claimReferral(db, { userId: u, code: 'firsttouch' })).destination).toBe('/hubs/makers');
    const again = await claimReferral(db, { userId: u, code: 'secondtouch' });
    expect(again.attributed).toBe(false);
    // destination resolves to the link they were ACTUALLY attributed to (first)
    expect(again.destination).toBe('/hubs/makers');
    expect((await db.select().from(referralAttributions).where(eq(referralAttributions.referredUserId, u))).length).toBe(1);
  });

  it('rejects self-referral and no-ops on unknown / disabled / invalid codes', async () => {
    await createReferralLink(db, owner, { code: 'selfie', actions: [] });
    expect((await claimReferral(db, { userId: owner, code: 'selfie' })).reason).toBe('self_referral');
    const u = (await createTestUser(db, { username: 'lonely' })).id;
    expect((await claimReferral(db, { userId: u, code: 'does-not-exist' })).reason).toBe('unknown_code');
    expect((await claimReferral(db, { userId: u, code: '!!' })).reason).toBe('invalid_code');
    const off = await createReferralLink(db, owner, { code: 'off', actions: [] });
    await updateReferralLink(db, owner, off.ok ? off.link.id : '', { status: 'disabled' });
    expect((await claimReferral(db, { userId: u, code: 'off' })).reason).toBe('unknown_code');
  });

  it('redirect action wins over the auto hub destination', async () => {
    await createReferralLink(db, owner, { code: 'land', actions: [{ type: 'join_hub', hubId }, { type: 'redirect', path: '/welcome' }] });
    const u = (await createTestUser(db, { username: 'lander' })).id;
    expect((await claimReferral(db, { userId: u, code: 'land' })).destination).toBe('/welcome');
  });
});

describe('referral claim-time re-validation + abuse guards', () => {
  let db: DB;
  let owner: string;

  beforeAll(async () => {
    db = await createTestDB();
    owner = (await createTestUser(db, { username: 'owner' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  it('does NOT auto-join a hub that was flipped private after the link was created', async () => {
    const hubId = await makeHub(db, owner, { slug: 'wasopen', name: 'WasOpen' });
    await createReferralLink(db, owner, { code: 'flip', actions: [{ type: 'join_hub', hubId }] });
    await db.update(hubs).set({ privacy: 'private' }).where(eq(hubs.id, hubId));
    const u = (await createTestUser(db, { username: 'flipuser' })).id;
    const res = await claimReferral(db, { userId: u, code: 'flip' });
    expect(res.attributed).toBe(true); // still attributed
    expect(res.destination).toBeNull(); // but not sent to the now-private hub
    const m = await db.select().from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, u)));
    expect(m.length).toBe(0); // and NOT joined
  });

  it('isolates a failed action: a hub the user is banned from does not block the others', async () => {
    const hubA = await makeHub(db, owner, { slug: 'banhub', name: 'Ban' });
    const hubB = await makeHub(db, owner, { slug: 'okhub', name: 'Ok' });
    await createReferralLink(db, owner, { code: 'multi', actions: [{ type: 'join_hub', hubId: hubA }, { type: 'join_hub', hubId: hubB }] });
    const u = (await createTestUser(db, { username: 'banned' })).id;
    await db.insert(hubBans).values({ hubId: hubA, userId: u, bannedById: owner });
    const res = await claimReferral(db, { userId: u, code: 'multi' });
    expect(res.attributed).toBe(true);
    expect((await db.select().from(hubMembers).where(and(eq(hubMembers.hubId, hubA), eq(hubMembers.userId, u)))).length).toBe(0);
    expect((await db.select().from(hubMembers).where(and(eq(hubMembers.hubId, hubB), eq(hubMembers.userId, u)))).length).toBe(1);
  });

  it('skips a join_hub whose hub was deleted after creation', async () => {
    const hubId = await makeHub(db, owner, { slug: 'doomed', name: 'Doomed' });
    await createReferralLink(db, owner, { code: 'gone', actions: [{ type: 'join_hub', hubId }] });
    await db.delete(hubs).where(eq(hubs.id, hubId));
    const u = (await createTestUser(db, { username: 'ghostjoin' })).id;
    const res = await claimReferral(db, { userId: u, code: 'gone' });
    expect(res.attributed).toBe(true);
    expect(res.destination).toBeNull();
  });

  it('a suspended owner\'s link stops attributing', async () => {
    const susOwner = (await createTestUser(db, { username: 'suspended' })).id;
    await createReferralLink(db, susOwner, { code: 'sus', actions: [] });
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, susOwner));
    const u = (await createTestUser(db, { username: 'visitor-sus' })).id;
    expect((await claimReferral(db, { userId: u, code: 'sus' })).reason).toBe('unknown_code');
    expect(await resolveReferral(db, 'sus')).toBeNull();
  });
});

describe('referral resolve + click', () => {
  let db: DB;
  let owner: string;
  let pubHub: string;

  beforeAll(async () => {
    db = await createTestDB();
    owner = (await createTestUser(db, { username: 'sarah', displayName: 'Sarah B' })).id;
    pubHub = await makeHub(db, owner, { slug: 'robots', name: 'Robotics' });
    await createReferralLink(db, owner, { code: 'sarahs', label: 'Join my crew', actions: [{ type: 'join_hub', hubId: pubHub }] });
  });
  afterAll(async () => { await closeTestDB(db); });

  it('resolves owner identity + PUBLIC hub names for the signup banner', async () => {
    const r = await resolveReferral(db, 'SARAHS');
    expect(r?.ownerUsername).toBe('sarah');
    expect(r?.ownerDisplayName).toBe('Sarah B');
    expect(r?.label).toBe('Join my crew');
    expect(r?.hubNames).toContain('Robotics');
  });

  it('does NOT leak the name of a hub flipped private after creation (anon endpoint)', async () => {
    await db.update(hubs).set({ privacy: 'private' }).where(eq(hubs.id, pubHub));
    const r = await resolveReferral(db, 'sarahs');
    expect(r).not.toBeNull();
    expect(r?.hubNames).toEqual([]); // name withheld
    await db.update(hubs).set({ privacy: 'public' }).where(eq(hubs.id, pubHub)); // restore
  });

  it('returns null for unknown codes', async () => {
    expect(await resolveReferral(db, 'nope-nope')).toBeNull();
  });

  it('records a click atomically and returns the link', async () => {
    expect((await recordReferralClick(db, 'sarahs'))?.clickCount).toBe(1);
    await recordReferralClick(db, 'sarahs');
    const [l] = await db.select().from(referralLinks).where(eq(referralLinks.code, 'sarahs'));
    expect(l?.clickCount).toBe(2);
    expect(await recordReferralClick(db, 'ghost-code')).toBeNull();
  });
});
