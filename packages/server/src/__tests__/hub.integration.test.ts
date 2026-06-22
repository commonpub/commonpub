import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub, getHubBySlug, listHubs, updateHub } from '../hub/hub.js';
import { joinHub, leaveHub, listMembers } from '../hub/members.js';
import { createPost, listPosts, likePost, unlikePost, hasLikedPost } from '../hub/posts.js';
import { banUser, checkBan, unbanUser, listBans, createInvite, listInvites, revokeInvite } from '../hub/moderation.js';

describe('hub integration', () => {
  let db: DB;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const owner = await createTestUser(db, { username: 'hubowner' });
    const member = await createTestUser(db, { username: 'hubmember' });
    ownerId = owner.id;
    memberId = member.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a community hub', async () => {
    const hub = await createHub(db, ownerId, {
      name: 'Test Community',
      hubType: 'community',
    });

    expect(hub).toBeDefined();
    expect(hub.name).toBe('Test Community');
    expect(hub.slug).toMatch(/^test-community/);
    expect(hub.hubType).toBe('community');
  });

  it('creates a product hub', async () => {
    const hub = await createHub(db, ownerId, {
      name: 'Arduino Nano',
      hubType: 'product',
      website: 'https://arduino.cc',
    });

    expect(hub).toBeDefined();
    expect(hub.slug).toMatch(/^arduino-nano/);
    expect(hub.hubType).toBe('product');
    expect(hub.website).toBe('https://arduino.cc');
  });

  it('persists icon, banner, privacy and categories on create', async () => {
    const hub = await createHub(db, ownerId, {
      name: 'Branded Hub',
      iconUrl: 'https://cdn.example.com/icon.webp',
      bannerUrl: 'https://cdn.example.com/banner.webp',
      privacy: 'unlisted',
      categories: ['robotics', '3d-printing'],
    });

    expect(hub.iconUrl).toBe('https://cdn.example.com/icon.webp');
    expect(hub.bannerUrl).toBe('https://cdn.example.com/banner.webp');
    expect(hub.privacy).toBe('unlisted');
    expect(hub.categories).toEqual(['robotics', '3d-printing']);
  });

  it('gets hub by slug', async () => {
    const created = await createHub(db, ownerId, { name: 'Findable Hub' });
    const found = await getHubBySlug(db, created.slug);

    expect(found).toBeDefined();
    expect(found!.name).toBe('Findable Hub');
  });

  it('lists hubs with search', async () => {
    await createHub(db, ownerId, { name: 'Searchable Hub XYZ' });
    const result = await listHubs(db, { search: 'Searchable' });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.some((h) => h.name === 'Searchable Hub XYZ')).toBe(true);
  });

  it('allows a user to join a hub', async () => {
    const hub = await createHub(db, ownerId, { name: 'Joinable Hub' });
    await joinHub(db, memberId, hub.id);

    const { items: members } = await listMembers(db, hub.id);
    const memberEntry = members.find((m) => m.userId === memberId);
    expect(memberEntry).toBeDefined();
    expect(memberEntry!.role).toBe('member');
  });

  it('allows a user to leave a hub', async () => {
    const hub = await createHub(db, ownerId, { name: 'Leaveable Hub' });
    await joinHub(db, memberId, hub.id);
    await leaveHub(db, memberId, hub.id);

    const { items: members } = await listMembers(db, hub.id);
    const memberEntry = members.find((m) => m.userId === memberId);
    expect(memberEntry).toBeUndefined();
  });

  it('creates and lists posts', async () => {
    const hub = await createHub(db, ownerId, { name: 'Post Hub' });
    await joinHub(db, memberId, hub.id);

    await createPost(db, memberId, {
      hubId: hub.id,
      content: 'Hello from the hub!',
      type: 'text',
    });

    const posts = await listPosts(db, hub.id);
    expect(posts.items.length).toBe(1);
    expect(posts.items[0]!.content).toBe('Hello from the hub!');
  });

  it('bans and unbans a user', async () => {
    const hub = await createHub(db, ownerId, { name: 'Mod Hub' });
    await joinHub(db, memberId, hub.id);

    await banUser(db, ownerId, hub.id, memberId, 'Test ban');
    const ban = await checkBan(db, hub.id, memberId);
    expect(ban).toBeDefined();

    const bans = await listBans(db, hub.id);
    expect(bans.length).toBe(1);

    await unbanUser(db, ownerId, hub.id, memberId);
    const banAfter = await checkBan(db, hub.id, memberId);
    expect(banAfter).toBeFalsy();
  });

  it('creates invite tokens', async () => {
    const hub = await createHub(db, ownerId, { name: 'Invite Hub' });

    const invite = await createInvite(db, ownerId, hub.id, 5);
    expect(invite).toBeDefined();
    expect(invite.token).toBeDefined();
    expect(invite.maxUses).toBe(5);

    const invites = await listInvites(db, hub.id);
    expect(invites.length).toBe(1);
  });

  it('revokes an invite (managers only)', async () => {
    const hub = await createHub(db, ownerId, { name: 'Revoke Hub' });
    const invite = await createInvite(db, ownerId, hub.id, 5);
    expect(invite).toBeTruthy();

    // A non-member cannot revoke (no manageMembers permission).
    const stranger = await createTestUser(db, { username: 'invite-stranger' });
    const denied = await revokeInvite(db, invite!.id, stranger.id, hub.id);
    expect(denied).toBe(false);
    expect((await listInvites(db, hub.id)).length).toBe(1);

    // The owner can revoke.
    const ok = await revokeInvite(db, invite!.id, ownerId, hub.id);
    expect(ok).toBe(true);
    expect((await listInvites(db, hub.id)).length).toBe(0);
  });

  it('joins an invite-only hub only with a valid token', async () => {
    const hub = await createHub(db, ownerId, { name: 'Invite Only Hub' });
    await updateHub(db, hub.id, ownerId, { joinPolicy: 'invite' });
    const joiner = await createTestUser(db, { username: 'invitee-valid' });

    // Without a token → rejected (this is the gap that made invite hubs unjoinable).
    const noToken = await joinHub(db, joiner.id, hub.id);
    expect(noToken.joined).toBe(false);

    // With a valid token → joined.
    const invite = await createInvite(db, ownerId, hub.id, 1);
    const withToken = await joinHub(db, joiner.id, hub.id, invite!.token);
    expect(withToken.joined).toBe(true);

    const { items } = await listMembers(db, hub.id);
    expect(items.some((m) => m.userId === joiner.id)).toBe(true);
  });

  it('rejects an invite token whose uses are exhausted', async () => {
    const hub = await createHub(db, ownerId, { name: 'Max Uses Hub' });
    await updateHub(db, hub.id, ownerId, { joinPolicy: 'invite' });
    const invite = await createInvite(db, ownerId, hub.id, 1); // single use
    const first = await createTestUser(db, { username: 'maxuse-first' });
    const second = await createTestUser(db, { username: 'maxuse-second' });

    expect((await joinHub(db, first.id, hub.id, invite!.token)).joined).toBe(true);
    // The single use is spent → the second redemption is rejected.
    expect((await joinHub(db, second.id, hub.id, invite!.token)).joined).toBe(false);
  });

  it('cannot revoke an invite belonging to a different hub (IDOR)', async () => {
    const hubA = await createHub(db, ownerId, { name: 'IDOR Hub A' });
    const otherOwner = await createTestUser(db, { username: 'idor-other-owner' });
    const hubB = await createHub(db, otherOwner.id, { name: 'IDOR Hub B' });
    const inviteB = await createInvite(db, otherOwner.id, hubB.id, 5);
    expect(inviteB).toBeTruthy();

    // ownerId manages hubA but NOT hubB. Revoking hubB's invite via hubA must fail
    // and must NOT delete the invite.
    const result = await revokeInvite(db, inviteB!.id, ownerId, hubA.id);
    expect(result).toBe(false);
    expect((await listInvites(db, hubB.id)).map((i) => i.id)).toContain(inviteB!.id);
  });

  it('a token submitted to the wrong hub does not consume a use', async () => {
    const hubA = await createHub(db, ownerId, { name: 'Wrong Hub A' });
    await updateHub(db, hubA.id, ownerId, { joinPolicy: 'invite' });
    const hubB = await createHub(db, ownerId, { name: 'Wrong Hub B' });
    await updateHub(db, hubB.id, ownerId, { joinPolicy: 'invite' });
    const inviteA = await createInvite(db, ownerId, hubA.id, 1); // single use, hub A only
    const joiner = await createTestUser(db, { username: 'wrong-hub-joiner' });

    // Submitting hub A's token to hub B is rejected WITHOUT burning the use...
    expect((await joinHub(db, joiner.id, hubB.id, inviteA!.token)).joined).toBe(false);
    // ...so the single use is intact and still works for hub A.
    expect((await joinHub(db, joiner.id, hubA.id, inviteA!.token)).joined).toBe(true);
  });

  it('updates hub settings', async () => {
    const hub = await createHub(db, ownerId, { name: 'Updatable Hub' });

    const updated = await updateHub(db, hub.id, ownerId, {
      description: 'Updated description',
      joinPolicy: 'approval',
      iconUrl: 'https://cdn.example.com/new-icon.webp',
      bannerUrl: 'https://cdn.example.com/new-banner.webp',
      privacy: 'private',
      website: 'https://updated.example.com',
    });

    expect(updated).toBeDefined();
    expect(updated!.description).toBe('Updated description');
    expect(updated!.joinPolicy).toBe('approval');
    expect(updated!.iconUrl).toBe('https://cdn.example.com/new-icon.webp');
    expect(updated!.bannerUrl).toBe('https://cdn.example.com/new-banner.webp');
    expect(updated!.privacy).toBe('private');
    expect(updated!.website).toBe('https://updated.example.com');
  });

  it('owner is auto-added as member with owner role', async () => {
    const hub = await createHub(db, ownerId, { name: 'Owner Check Hub' });
    const { items: members } = await listMembers(db, hub.id);
    const ownerMember = members.find((m) => m.userId === ownerId);

    expect(ownerMember).toBeDefined();
    expect(ownerMember!.role).toBe('owner');
  });

  // PGlite doesn't support ON CONFLICT ... DO NOTHING ... RETURNING — skip until real Postgres test DB
  it.skip('likes and unlikes a hub post', async () => {
    const hub = await createHub(db, ownerId, { name: 'Like Test Hub' });
    await joinHub(db, memberId, hub.id);
    const post = await createPost(db, ownerId, { hubId: hub.id, content: 'Test post for likes' });

    // Like
    const liked = await likePost(db, post.id, memberId);
    expect(liked).toBe(true);

    // Check liked status
    const isLiked = await hasLikedPost(db, post.id, memberId);
    expect(isLiked).toBe(true);

    // Unlike
    const unliked = await unlikePost(db, post.id, memberId);
    expect(unliked).toBe(true);

    // Confirm unliked
    const isStillLiked = await hasLikedPost(db, post.id, memberId);
    expect(isStillLiked).toBe(false);
  });

  it.skip('liking a post twice is idempotent', async () => {
    const hub = await createHub(db, ownerId, { name: 'Idempotent Like Hub' });
    await joinHub(db, memberId, hub.id);
    const post = await createPost(db, ownerId, { hubId: hub.id, content: 'Double like test' });

    await likePost(db, post.id, memberId);
    const secondLike = await likePost(db, post.id, memberId);
    // onConflictDoNothing means second like returns false (no new row)
    expect(secondLike).toBe(false);

    // Still liked
    expect(await hasLikedPost(db, post.id, memberId)).toBe(true);
  });
});
