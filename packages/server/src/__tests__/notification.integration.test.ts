import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../notification/notification.js';
import type { NotificationType } from '../notification/notification.js';

describe('notification integration', () => {
  let db: DB;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDB();
    const a = await createTestUser(db, { username: 'alice' });
    const b = await createTestUser(db, { username: 'bob' });
    alice = a.id;
    bob = b.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a notification', async () => {
    const notif = await createNotification(db, {
      userId: alice,
      type: 'like',
      title: 'New like',
      message: 'Someone liked your post',
    });

    expect(notif).toBeDefined();
    expect(notif.type).toBe('like');
    expect(notif.title).toBe('New like');
    expect(notif.message).toBe('Someone liked your post');
    expect(notif.userId).toBe(alice);
  });

  it('creates notification with actor', async () => {
    const notif = await createNotification(db, {
      userId: alice,
      type: 'follow',
      title: 'New follower',
      message: 'Bob followed you',
      actorId: bob,
    });

    expect(notif.actorId).toBe(bob);
  });

  it('lists notifications for a user', async () => {
    // Clear state by creating a fresh user
    const user = await createTestUser(db, { username: 'list-test' });

    await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Notif 3',
      message: 'Message 3',
    });

    const result = await listNotifications(db, { userId: user.id });
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('filters notifications by type', async () => {
    const user = await createTestUser(db, { username: 'type-filter' });

    await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Like notif',
      message: 'A like',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Comment notif',
      message: 'A comment',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Follow notif',
      message: 'A follow',
    });

    const result = await listNotifications(db, {
      userId: user.id,
      type: 'like' as NotificationType,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.type).toBe('like');
  });

  it('filters notifications by read status', async () => {
    const user = await createTestUser(db, { username: 'read-filter' });

    const n1 = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });

    await markNotificationRead(db, n1.id, user.id);

    const unread = await listNotifications(db, {
      userId: user.id,
      read: false,
    });
    expect(unread.items).toHaveLength(1);
    expect(unread.items[0]!.title).toBe('Notif 2');
  });

  it('gets unread count', async () => {
    const user = await createTestUser(db, { username: 'unread-count' });

    const n1 = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Notif 3',
      message: 'Message 3',
    });

    const count1 = await getUnreadCount(db, user.id);
    expect(count1).toBe(3);

    await markNotificationRead(db, n1.id, user.id);

    const count2 = await getUnreadCount(db, user.id);
    expect(count2).toBe(2);
  });

  it('marks a single notification read', async () => {
    const user = await createTestUser(db, { username: 'mark-read' });

    const notif = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'To mark read',
      message: 'Will be read',
    });

    await markNotificationRead(db, notif.id, user.id);

    const result = await listNotifications(db, {
      userId: user.id,
      read: true,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.read).toBe(true);
  });

  it('marks all notifications read', async () => {
    const user = await createTestUser(db, { username: 'mark-all-read' });

    await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Notif 3',
      message: 'Message 3',
    });

    await markAllNotificationsRead(db, user.id);

    const result = await listNotifications(db, { userId: user.id });
    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.read).toBe(true);
    }
  });

  it('deletes a notification', async () => {
    const user = await createTestUser(db, { username: 'delete-notif' });

    const notif = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'To delete',
      message: 'Will be deleted',
    });

    await deleteNotification(db, notif.id, user.id);

    const result = await listNotifications(db, { userId: user.id });
    expect(result.items).toHaveLength(0);
  });

  it('does not show other users notifications', async () => {
    const userA = await createTestUser(db, { username: 'isolated-a' });
    const userB = await createTestUser(db, { username: 'isolated-b' });

    await createNotification(db, {
      userId: userA.id,
      type: 'like',
      title: 'Private notif',
      message: 'Only for user A',
    });

    const result = await listNotifications(db, { userId: userB.id });
    expect(result.items).toHaveLength(0);
  });
});
