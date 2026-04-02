/**
 * Integration tests for Session 100 changes:
 * - editPost (hub post editing)
 * - Hub post notifications (like, reply, new post)
 * - Fork/build content notifications
 * - Hub membership notifications (join, kick, ban, role change)
 * - Notification actorAvatarUrl field
 * - Message senderName/senderAvatarUrl fields
 * - editPostSchema validation
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub } from '../hub/hub.js';
import { joinHub, kickMember, changeRole } from '../hub/members.js';
import { createPost, editPost, likePost, createReply } from '../hub/posts.js';
import { banUser } from '../hub/moderation.js';
import { createNotification, listNotifications, getUnreadCount } from '../notification/notification.js';
import { createContent, publishContent, forkContent, toggleBuildMark } from '../content/content.js';
import { createConversation, sendMessage, getConversationMessages } from '../messaging/messaging.js';
import { editPostSchema } from '@commonpub/schema';

describe('session 100 — hub post editing', () => {
  let db: DB;
  let authorId: string;
  let otherId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const author = await createTestUser(db, { username: 'postauthor', displayName: 'Post Author' });
    const other = await createTestUser(db, { username: 'other' });
    authorId = author.id;
    otherId = other.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('allows author to edit their post', async () => {
    const hub = await createHub(db, authorId, { name: 'Edit Test Hub' });
    const post = await createPost(db, authorId, { hubId: hub.id, content: 'Original content' });

    const updated = await editPost(db, post.id, authorId, hub.id, { content: 'Updated content' });
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe('Updated content');
  });

  it('rejects edit from non-author', async () => {
    const hub = await createHub(db, authorId, { name: 'Auth Test Hub' });
    await joinHub(db, otherId, hub.id);
    const post = await createPost(db, authorId, { hubId: hub.id, content: 'Author only' });

    const result = await editPost(db, post.id, otherId, hub.id, { content: 'Hacked' });
    expect(result).toBeNull();
  });

  it('returns null for nonexistent post', async () => {
    const result = await editPost(db, '00000000-0000-0000-0000-000000000000', authorId, '00000000-0000-0000-0000-000000000000', { content: 'No post' });
    expect(result).toBeNull();
  });

  it('rejects edit with wrong hubId (cross-hub attack)', async () => {
    const hub1 = await createHub(db, authorId, { name: 'Cross Hub 1' });
    const hub2 = await createHub(db, authorId, { name: 'Cross Hub 2' });
    const post = await createPost(db, authorId, { hubId: hub1.id, content: 'In hub 1' });
    const result = await editPost(db, post.id, authorId, hub2.id, { content: 'Cross-hub attack' });
    expect(result).toBeNull();
  });

  it('rejects edit from banned user', async () => {
    const hub = await createHub(db, authorId, { name: 'Ban Edit Hub' });
    await joinHub(db, otherId, hub.id);
    const post = await createPost(db, otherId, { hubId: hub.id, content: 'Before ban' });
    await banUser(db, authorId, hub.id, otherId, 'test ban');
    const result = await editPost(db, post.id, otherId, hub.id, { content: 'After ban' });
    expect(result).toBeNull();
  });
});

describe('session 100 — editPostSchema validation', () => {
  it('accepts valid content', () => {
    const result = editPostSchema.safeParse({ content: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = editPostSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content over 10000 chars', () => {
    const result = editPostSchema.safeParse({ content: 'x'.repeat(10001) });
    expect(result.success).toBe(false);
  });

  it('accepts content at max length', () => {
    const result = editPostSchema.safeParse({ content: 'x'.repeat(10000) });
    expect(result.success).toBe(true);
  });
});

describe('session 100 — hub post like notifications', () => {
  let db: DB;
  let authorId: string;
  let likerId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const author = await createTestUser(db, { username: 'likeauthor', displayName: 'Like Author' });
    const liker = await createTestUser(db, { username: 'liker', displayName: 'The Liker' });
    authorId = author.id;
    likerId = liker.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates notification when someone likes a hub post', async () => {
    const hub = await createHub(db, authorId, { name: 'Like Notif Hub' });
    await joinHub(db, likerId, hub.id);
    const post = await createPost(db, authorId, { hubId: hub.id, content: 'Likeable post' });

    const beforeCount = await getUnreadCount(db, authorId);
    await likePost(db, likerId, post.id);
    const afterCount = await getUnreadCount(db, authorId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: authorId, type: 'like' });
    const likeNotif = items.find((n) => n.message.includes('liked your post'));
    expect(likeNotif).toBeDefined();
    expect(likeNotif!.message).toContain('The Liker');
  });

  it('does not notify on self-like', async () => {
    const hub = await createHub(db, authorId, { name: 'Self Like Hub' });
    const post = await createPost(db, authorId, { hubId: hub.id, content: 'Self like test' });

    const beforeCount = await getUnreadCount(db, authorId);
    await likePost(db, authorId, post.id);
    const afterCount = await getUnreadCount(db, authorId);

    // Should not have increased (self-like doesn't notify)
    expect(afterCount).toBe(beforeCount);
  });
});

describe('session 100 — hub post reply notifications', () => {
  let db: DB;
  let authorId: string;
  let replierId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const author = await createTestUser(db, { username: 'replyauthor', displayName: 'Reply Author' });
    const replier = await createTestUser(db, { username: 'replier', displayName: 'The Replier' });
    authorId = author.id;
    replierId = replier.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates notification when someone replies to a hub post', async () => {
    const hub = await createHub(db, authorId, { name: 'Reply Notif Hub' });
    await joinHub(db, replierId, hub.id);
    const post = await createPost(db, authorId, { hubId: hub.id, content: 'Replyable post' });

    const beforeCount = await getUnreadCount(db, authorId);
    await createReply(db, replierId, { postId: post.id, content: 'Great post!' });
    const afterCount = await getUnreadCount(db, authorId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: authorId, type: 'comment' });
    const replyNotif = items.find((n) => n.message.includes('replied to your post'));
    expect(replyNotif).toBeDefined();
    expect(replyNotif!.message).toContain('The Replier');
  });
});

describe('session 100 — hub new post notifications', () => {
  let db: DB;
  let ownerId: string;
  let posterId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const owner = await createTestUser(db, { username: 'hubowner100', displayName: 'Hub Owner' });
    const poster = await createTestUser(db, { username: 'poster', displayName: 'The Poster' });
    ownerId = owner.id;
    posterId = poster.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('notifies hub owner when someone posts', async () => {
    const hub = await createHub(db, ownerId, { name: 'Post Notif Hub' });
    await joinHub(db, posterId, hub.id);

    const beforeCount = await getUnreadCount(db, ownerId);
    await createPost(db, posterId, { hubId: hub.id, content: 'New post!' });
    const afterCount = await getUnreadCount(db, ownerId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: ownerId, type: 'hub' });
    const postNotif = items.find((n) => n.message.includes('posted in'));
    expect(postNotif).toBeDefined();
  });

  it('does not notify owner for their own posts', async () => {
    const hub = await createHub(db, ownerId, { name: 'Own Post Hub' });

    const beforeCount = await getUnreadCount(db, ownerId);
    await createPost(db, ownerId, { hubId: hub.id, content: 'Owner post' });
    const afterCount = await getUnreadCount(db, ownerId);

    expect(afterCount).toBe(beforeCount);
  });
});

describe('session 100 — hub membership notifications', () => {
  let db: DB;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const owner = await createTestUser(db, { username: 'memowner', displayName: 'Mem Owner' });
    const member = await createTestUser(db, { username: 'memmember', displayName: 'Mem Member' });
    ownerId = owner.id;
    memberId = member.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('notifies owner when someone joins', async () => {
    const hub = await createHub(db, ownerId, { name: 'Join Notif Hub' });

    const beforeCount = await getUnreadCount(db, ownerId);
    await joinHub(db, memberId, hub.id);
    const afterCount = await getUnreadCount(db, ownerId);

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('notifies user when kicked', async () => {
    const hub = await createHub(db, ownerId, { name: 'Kick Notif Hub' });
    await joinHub(db, memberId, hub.id);

    const beforeCount = await getUnreadCount(db, memberId);
    await kickMember(db, ownerId, hub.id, memberId);
    const afterCount = await getUnreadCount(db, memberId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: memberId, type: 'hub' });
    expect(items.some((n) => n.message.includes('removed from'))).toBe(true);
  });

  it('notifies user when role changed', async () => {
    const hub = await createHub(db, ownerId, { name: 'Role Notif Hub' });
    await joinHub(db, memberId, hub.id);

    const beforeCount = await getUnreadCount(db, memberId);
    await changeRole(db, ownerId, hub.id, memberId, 'moderator');
    const afterCount = await getUnreadCount(db, memberId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: memberId, type: 'hub' });
    expect(items.some((n) => n.message.includes('moderator'))).toBe(true);
  });

  it('notifies user when banned', async () => {
    const hub = await createHub(db, ownerId, { name: 'Ban Notif Hub' });
    await joinHub(db, memberId, hub.id);

    const beforeCount = await getUnreadCount(db, memberId);
    await banUser(db, ownerId, hub.id, memberId, 'Spam');
    const afterCount = await getUnreadCount(db, memberId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: memberId, type: 'hub' });
    expect(items.some((n) => n.message.includes('banned') && n.message.includes('Spam'))).toBe(true);
  });
});

describe('session 100 — fork/build content notifications', () => {
  let db: DB;
  let authorId: string;
  let forkerId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const author = await createTestUser(db, { username: 'contentauthor', displayName: 'Content Author' });
    const forker = await createTestUser(db, { username: 'forker', displayName: 'The Forker' });
    authorId = author.id;
    forkerId = forker.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('notifies author when content is forked', async () => {
    const content = await createContent(db, authorId, {
      type: 'project',
      title: 'Forkable Project',
      description: 'A project to fork',
    });
    await publishContent(db, content.id, authorId);

    const beforeCount = await getUnreadCount(db, authorId);
    await forkContent(db, content.id, forkerId);
    const afterCount = await getUnreadCount(db, authorId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: authorId });
    expect(items.some((n) => n.message.includes('forked'))).toBe(true);
  });

  it('notifies author when someone marks "I built this"', async () => {
    const content = await createContent(db, authorId, {
      type: 'project',
      title: 'Buildable Project',
      description: 'A project to build',
    });
    await publishContent(db, content.id, authorId);

    const beforeCount = await getUnreadCount(db, authorId);
    await toggleBuildMark(db, content.id, forkerId);
    const afterCount = await getUnreadCount(db, authorId);

    expect(afterCount).toBeGreaterThan(beforeCount);

    const { items } = await listNotifications(db, { userId: authorId });
    expect(items.some((n) => n.message.includes('built this'))).toBe(true);
  });

  it('does not notify on self-fork', async () => {
    const content = await createContent(db, authorId, {
      type: 'article',
      title: 'Self Fork Test',
      description: 'Testing self-fork',
    });
    await publishContent(db, content.id, authorId);

    const beforeCount = await getUnreadCount(db, authorId);
    await forkContent(db, content.id, authorId);
    const afterCount = await getUnreadCount(db, authorId);

    expect(afterCount).toBe(beforeCount);
  });
});

describe('session 100 — notification actorAvatarUrl', () => {
  let db: DB;
  let userId: string;
  let actorId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'recipient100' });
    const actor = await createTestUser(db, { username: 'actor100', displayName: 'Actor', avatarUrl: 'https://example.com/avatar.png' });
    userId = user.id;
    actorId = actor.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('includes actorAvatarUrl in notification listing', async () => {
    await createNotification(db, {
      userId,
      type: 'like',
      title: 'Test',
      message: 'Avatar test notification',
      actorId,
    });

    const { items } = await listNotifications(db, { userId });
    const notif = items.find((n) => n.message === 'Avatar test notification');
    expect(notif).toBeDefined();
    expect(notif!.actorAvatarUrl).toBe('https://example.com/avatar.png');
  });

  it('returns null actorAvatarUrl when no actor', async () => {
    const notif = await createNotification(db, {
      userId,
      type: 'system',
      title: 'System',
      message: 'System notification',
    });
    expect(notif.actorAvatarUrl).toBeNull();
  });
});

describe('session 100 — message sender info', () => {
  let db: DB;
  let aliceId: string;
  let bobId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const alice = await createTestUser(db, { username: 'alice100', displayName: 'Alice', avatarUrl: 'https://example.com/alice.png' });
    const bob = await createTestUser(db, { username: 'bob100', displayName: 'Bob' });
    aliceId = alice.id;
    bobId = bob.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('sendMessage includes senderName and senderAvatarUrl', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    const msg = await sendMessage(db, conv.id, aliceId, 'Hello Bob!');

    expect(msg.senderName).toBe('Alice');
    expect(msg.senderAvatarUrl).toBe('https://example.com/alice.png');
  });

  it('getConversationMessages includes sender info', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'Message 1');
    await sendMessage(db, conv.id, bobId, 'Message 2');

    const messages = await getConversationMessages(db, conv.id, aliceId);
    expect(messages.length).toBe(2);

    const aliceMsg = messages.find((m) => m.senderId === aliceId);
    expect(aliceMsg!.senderName).toBe('Alice');
    expect(aliceMsg!.senderAvatarUrl).toBe('https://example.com/alice.png');

    const bobMsg = messages.find((m) => m.senderId === bobId);
    expect(bobMsg!.senderName).toBe('Bob');
    expect(bobMsg!.senderAvatarUrl).toBeNull(); // Bob has no avatar
  });
});
