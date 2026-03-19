import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { notifications, users } from '@commonpub/schema';
import type { DB } from './types.js';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  actorId: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: Date;
}

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'contest' | 'certificate' | 'hub' | 'system';

export interface NotificationFilters {
  userId: string;
  type?: NotificationType;
  read?: boolean;
  limit?: number;
  offset?: number;
}

export async function listNotifications(
  db: DB,
  filters: NotificationFilters,
): Promise<{ items: NotificationItem[]; total: number }> {
  const conditions = [eq(notifications.userId, filters.userId)];

  if (filters.type) {
    conditions.push(
      eq(notifications.type, filters.type),
    );
  }
  if (filters.read !== undefined) {
    conditions.push(eq(notifications.read, filters.read));
  }

  const where = and(...conditions);
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        notification: notifications,
        actorDisplayName: users.displayName,
        actorUsername: users.username,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where),
  ]);

  const items: NotificationItem[] = rows.map((row) => ({
    id: row.notification.id,
    userId: row.notification.userId,
    type: row.notification.type,
    title: row.notification.title,
    message: row.notification.message,
    link: row.notification.link,
    actorId: row.notification.actorId,
    actorName: row.actorDisplayName ?? row.actorUsername ?? 'Someone',
    read: row.notification.read,
    createdAt: row.notification.createdAt,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getUnreadCount(db: DB, userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

  return result[0]?.count ?? 0;
}

export async function markNotificationRead(
  db: DB,
  notificationId: string,
  userId: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(
  db: DB,
  userId: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}

export async function deleteNotification(
  db: DB,
  notificationId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function createNotification(
  db: DB,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    actorId?: string;
  },
): Promise<NotificationItem> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      actorId: input.actorId ?? null,
    })
    .returning();

  return {
    id: row!.id,
    userId: row!.userId,
    type: row!.type,
    title: row!.title,
    message: row!.message,
    link: row!.link,
    actorId: row!.actorId,
    actorName: null,
    read: row!.read,
    createdAt: row!.createdAt,
  };
}
