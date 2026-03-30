import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub, getHubBySlug, listHubs, updateHub } from '../hub/hub.js';
import { joinHub, leaveHub, listMembers } from '../hub/members.js';
import { createPost, listPosts } from '../hub/posts.js';
import { banUser, checkBan, unbanUser, listBans, createInvite, listInvites } from '../hub/moderation.js';

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
  });

  it('creates a product hub', async () => {
    const hub = await createHub(db, ownerId, {
      name: 'Arduino Nano',
      hubType: 'product',
      website: 'https://arduino.cc',
    });

    expect(hub).toBeDefined();
    expect(hub.slug).toMatch(/^arduino-nano/);
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

  it('updates hub settings', async () => {
    const hub = await createHub(db, ownerId, { name: 'Updatable Hub' });

    const updated = await updateHub(db, hub.id, ownerId, {
      description: 'Updated description',
      joinPolicy: 'approval',
    });

    expect(updated).toBeDefined();
  });

  it('owner is auto-added as member with owner role', async () => {
    const hub = await createHub(db, ownerId, { name: 'Owner Check Hub' });
    const { items: members } = await listMembers(db, hub.id);
    const ownerMember = members.find((m) => m.userId === ownerId);

    expect(ownerMember).toBeDefined();
    expect(ownerMember!.role).toBe('owner');
  });
});
