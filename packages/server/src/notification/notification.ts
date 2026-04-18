import { eq, and, desc, sql } from 'drizzle-orm';
import { notifications, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { publishSseEvent } from '../realtime/index.js';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  read: boolean;
  createdAt: Date;
}

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'contest' | 'certificate' | 'hub' | 'system' | 'fork' | 'build';

// --- Email notification preferences ---

interface EmailNotificationPrefs {
  digest?: 'daily' | 'weekly' | 'none';
  likes?: boolean;
  comments?: boolean;
  follows?: boolean;
  mentions?: boolean;
}

/** Map notification types to their preference key (only types that have a user-facing toggle) */
const TYPE_TO_PREF: Partial<Record<NotificationType, keyof Omit<EmailNotificationPrefs, 'digest'>>> = {
  like: 'likes',
  comment: 'comments',
  follow: 'follows',
  mention: 'mentions',
};

/**
 * Check whether a user should receive an instant email for a notification type.
 * Returns false if the user has no preferences set, the type has no toggle, or the user disabled it.
 * Also returns false if the user chose digest mode (daily/weekly) — those are batched separately.
 */
export async function shouldEmailNotification(
  db: DB,
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const prefKey = TYPE_TO_PREF[type];
  if (!prefKey) return false; // types without a toggle never trigger instant email

  const [row] = await db
    .select({ emailNotifications: users.emailNotifications })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.emailNotifications) return false;

  const prefs = row.emailNotifications as EmailNotificationPrefs;

  // If digest mode is daily or weekly, instant emails are suppressed — digest plugin handles them
  if (prefs.digest === 'daily' || prefs.digest === 'weekly') return false;

  return prefs[prefKey] === true;
}

/**
 * Get user email and username for sending notification emails.
 */
export async function getNotificationEmailTarget(
  db: DB,
  userId: string,
): Promise<{ email: string; username: string } | null> {
  const [row] = await db
    .select({ email: users.email, username: users.username, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.emailVerified) return null;
  return { email: row.email, username: row.username };
}

// --- Module-level email sender registration ---

type NotificationEmailSender = (db: DB, notification: NotificationItem) => Promise<void>;
let registeredEmailSender: NotificationEmailSender | null = null;

/**
 * Register a callback that sends notification emails. Called once by the Nitro plugin at startup.
 * The callback handles shouldEmailNotification checks, template rendering, and actual sending.
 */
export function setNotificationEmailSender(sender: NotificationEmailSender): void {
  registeredEmailSender = sender;
}

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
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select({
        notification: notifications,
        actorDisplayName: users.displayName,
        actorUsername: users.username,
        actorAvatarUrl: users.avatarUrl,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, notifications, where),
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
    actorAvatarUrl: row.actorAvatarUrl ?? null,
    read: row.notification.read,
    createdAt: row.notification.createdAt,
  }));

  return { items, total };
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

  const notification: NotificationItem = {
    id: row!.id,
    userId: row!.userId,
    type: row!.type,
    title: row!.title,
    message: row!.message,
    link: row!.link,
    actorId: row!.actorId,
    actorName: null,
    actorAvatarUrl: null,
    read: row!.read,
    createdAt: row!.createdAt,
  };

  // Fire-and-forget email sending (don't block notification creation)
  if (registeredEmailSender) {
    registeredEmailSender(db, notification).catch((err) => {
      console.error('[notification-email] Failed to send:', err instanceof Error ? err.message : err);
    });
  }

  // Fire-and-forget SSE fanout so any connected stream for this user
  // (including on other Nitro processes, when Redis is enabled) re-queries
  // counts immediately rather than waiting for the next 10 s poll tick.
  publishSseEvent(input.userId, { type: 'notification', notificationId: notification.id }).catch(() => {});

  return notification;
}
