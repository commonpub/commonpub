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
  unsubscribedAll?: boolean;
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

  // Hard opt-out of all non-transactional mail (one-click unsubscribe).
  if (prefs.unsubscribedAll) return false;

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
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit)
      .offset(offset),
    // COUNT(*) only on the first page: the notifications UI detects "has more" via
    // items.length and never reads `total` on deep pages. `-1` = "not computed".
    offset === 0 ? countRows(db, notifications, where) : Promise.resolve(-1),
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
  // Dedup social notifications (like/comment/follow/mention) via the
  // UNIQUE constraint on (user_id, type, actor_id, link). System
  // notifications (no actor or no link, i.e. NULL on either column)
  // bypass dedup naturally because Postgres treats NULL as distinct
  // in UNIQUE constraints — each system notification gets its own row.
  //
  // Implementation: try INSERT; on a UNIQUE violation (Postgres 23505)
  // refresh the existing row's title/message/read/createdAt instead. We
  // avoid drizzle's `onConflictDoUpdate` because PGlite's planner rejects
  // the inferred-arbiter index even with a literal UNIQUE constraint
  // (42P10), and Drizzle has no `ON CONFLICT ON CONSTRAINT` form. The
  // try/catch approach is portable across Postgres + PGlite and matches
  // the "conflict bumps timestamp" semantics on real Postgres.
  const values = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link ?? null,
    actorId: input.actorId ?? null,
  };

  let row: typeof notifications.$inferSelect | undefined;
  try {
    const [inserted] = await db.insert(notifications).values(values).returning();
    row = inserted;
  } catch (err: unknown) {
    // 23505 = unique_violation. Drizzle wraps the underlying PG error,
    // so the code may be on `err.code`, on `err.cause.code`, or only
    // mentioned in the message — check all three.
    const e = err as { code?: string; cause?: { code?: string }; message?: string };
    const isUniqueViolation =
      e.code === '23505'
      || e.cause?.code === '23505'
      || /23505|unique[_ ]violation|duplicate key/i.test(e.message ?? '');
    if (isUniqueViolation && input.actorId != null && input.link != null) {
      const [updated] = await db
        .update(notifications)
        .set({ title: input.title, message: input.message, read: false, createdAt: new Date() })
        .where(and(
          eq(notifications.userId, input.userId),
          eq(notifications.type, input.type),
          eq(notifications.actorId, input.actorId),
          eq(notifications.link, input.link),
        ))
        .returning();
      // Race guard: if the row that caused our INSERT conflict was
      // deleted (e.g., by deleteNotification or user-cascade) between
      // the INSERT failure and this UPDATE, `returning()` is empty.
      // Re-throw the original conflict rather than crashing on `row!.id`.
      if (!updated) throw err;
      row = updated;
    } else {
      throw err;
    }
  }

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
