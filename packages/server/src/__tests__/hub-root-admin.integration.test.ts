import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { hubs, hubMembers, hubPosts, hubShares, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub, deleteHub } from '../hub/hub.js';
import { joinHub, changeRole, kickMember } from '../hub/members.js';
import { createPost, deletePost, togglePinPost, toggleLockPost, shareContent, unshareContent } from '../hub/posts.js';
import { createHubFlag, listHubFlags, resolveHubFlag } from '../hub/flags.js';

const ADMIN = { asPlatformAdmin: true } as const;

/**
 * Platform-admin (root) override across hub management. `outsider` is NEVER a
 * member of the hubs under test — they succeed ONLY with the { asPlatformAdmin }
 * option, and are denied without it. Owner-protection invariants are preserved.
 */
describe('hub root-admin override (platform admins manage any community)', () => {
  let db: DB;
  let ownerId: string, memberId: string, outsiderId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'root-owner' })).id;
    memberId = (await createTestUser(db, { username: 'root-member' })).id;
    outsiderId = (await createTestUser(db, { username: 'root-admin' })).id; // NOT a member of any hub
  });
  afterAll(async () => { await closeTestDB(db); });

  async function hubWithMember(name: string): Promise<string> {
    const hubId = (await createHub(db, ownerId, { name, hubType: 'community' })).id;
    await joinHub(db, memberId, hubId);
    return hubId;
  }
  async function roleOf(hubId: string, userId: string): Promise<string | null> {
    const [r] = await db.select({ role: hubMembers.role }).from(hubMembers)
      .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
    return r?.role ?? null;
  }

  // --- Post moderation ---

  it('a non-member cannot delete/pin/lock a post, but a platform admin can', async () => {
    const hubId = await hubWithMember('Root Posts');
    const post = await createPost(db, memberId, { hubId, type: 'discussion', content: 'hi' });

    expect(await deletePost(db, post.id, outsiderId, hubId)).toBe(false);
    expect(await togglePinPost(db, post.id, outsiderId, hubId)).toBeNull();
    expect(await toggleLockPost(db, post.id, outsiderId, hubId)).toBeNull();

    expect((await togglePinPost(db, post.id, outsiderId, hubId, ADMIN))?.pinned).toBe(true);
    expect((await toggleLockPost(db, post.id, outsiderId, hubId, ADMIN))?.locked).toBe(true);
    expect(await deletePost(db, post.id, outsiderId, hubId, ADMIN)).toBe(true);
  });

  // --- Delete hub ---

  it('only the owner (or a platform admin) can delete a hub', async () => {
    const hubId = await hubWithMember('Root Delete');
    expect(await deleteHub(db, hubId, outsiderId)).toBe(false);           // non-owner
    expect(await deleteHub(db, hubId, memberId)).toBe(false);             // member, not owner
    expect(await deleteHub(db, hubId, outsiderId, ADMIN)).toBe(true);     // platform admin
    const [h] = await db.select({ d: hubs.deletedAt }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    expect(h?.d).not.toBeNull();
  });

  // --- Member management (owner-protected) ---

  it('a platform admin can change/kick any NON-owner member, but never the owner', async () => {
    const hubId = await hubWithMember('Root Members');

    // non-member cannot manage without override
    expect((await changeRole(db, outsiderId, hubId, memberId, 'moderator')).changed).toBe(false);
    expect((await kickMember(db, outsiderId, hubId, memberId)).kicked).toBe(false);

    // platform admin promotes the member to moderator
    expect((await changeRole(db, outsiderId, hubId, memberId, 'moderator', ADMIN)).changed).toBe(true);
    expect(await roleOf(hubId, memberId)).toBe('moderator');

    // owner is protected — admin cannot change or promote-to-owner
    expect((await changeRole(db, outsiderId, hubId, ownerId, 'admin', ADMIN)).error).toMatch(/owner/i);
    expect((await changeRole(db, outsiderId, hubId, memberId, 'owner' as never, ADMIN)).error).toMatch(/owner/i);
    expect(await roleOf(hubId, ownerId)).toBe('owner');

    // admin kicks the (non-owner) member; cannot kick the owner
    expect((await kickMember(db, outsiderId, hubId, ownerId, ADMIN)).error).toMatch(/owner/i);
    expect((await kickMember(db, outsiderId, hubId, memberId, ADMIN)).kicked).toBe(true);
    expect(await roleOf(hubId, memberId)).toBeNull();
  });

  // --- Unshare removes both the link AND the feed post ---

  it('unshareContent removes the hub_share AND the orphan share post; a platform admin can unshare any', async () => {
    const hubId = await hubWithMember('Root Unshare');
    const [content] = await db.insert(contentItems).values({
      authorId: memberId, type: 'project', title: 'Shared Proj', slug: `shared-proj-${Date.now()}`, status: 'published',
    }).returning({ id: contentItems.id });
    const contentId = content!.id;

    // member shares their project -> creates a hub_share + a type='share' post
    await shareContent(db, memberId, hubId, contentId);
    const sharesBefore = await db.select().from(hubShares).where(and(eq(hubShares.hubId, hubId), eq(hubShares.contentId, contentId)));
    const postsBefore = await db.select().from(hubPosts).where(and(eq(hubPosts.hubId, hubId), eq(hubPosts.type, 'share')));
    expect(sharesBefore.length).toBe(1);
    expect(postsBefore.length).toBe(1);

    // a non-sharer non-admin cannot unshare
    expect(await unshareContent(db, outsiderId, hubId, contentId)).toBe(false);

    // platform admin unshares -> BOTH the share row and the share post are gone
    expect(await unshareContent(db, outsiderId, hubId, contentId, ADMIN)).toBe(true);
    const sharesAfter = await db.select().from(hubShares).where(and(eq(hubShares.hubId, hubId), eq(hubShares.contentId, contentId)));
    const postsAfter = await db.select().from(hubPosts).where(and(eq(hubPosts.hubId, hubId), eq(hubPosts.type, 'share')));
    expect(sharesAfter.length).toBe(0);
    expect(postsAfter.length).toBe(0);
  });

  // --- Flag review queue ---

  it('a platform admin can list + resolve any hub flag queue (non-member)', async () => {
    const hubId = await hubWithMember('Root Flags');
    // owner flags the member (owner has flagMember)
    await createHubFlag(db, ownerId, hubId, { targetType: 'member', targetId: memberId, reason: 'test' });

    // non-member cannot review without override
    expect((await listHubFlags(db, outsiderId, hubId)).error).toMatch(/permission/i);

    // platform admin can list + resolve
    const q = await listHubFlags(db, outsiderId, hubId, undefined, ADMIN);
    expect(q.items.length).toBe(1);
    expect((await resolveHubFlag(db, outsiderId, hubId, q.items[0]!.id, 'actioned', ADMIN)).resolved).toBe(true);
    // resolving is advisory — the member is NOT removed
    expect(await roleOf(hubId, memberId)).toBe('member');
  });
});
