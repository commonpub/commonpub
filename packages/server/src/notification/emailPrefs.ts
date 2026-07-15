import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { NotificationType } from './notification.js';

// Email-notification preference gating, split out of notification.ts (session 227)
// so the "should this notification email, and to whom" logic is testable and
// changeable without touching notification CRUD.

interface EmailNotificationPrefs {
  digest?: 'daily' | 'weekly' | 'none';
  likes?: boolean;
  comments?: boolean;
  follows?: boolean;
  mentions?: boolean;
  unsubscribedAll?: boolean;
}

/** Map notification types to their preference key (only types that have a user-facing toggle). */
const TYPE_TO_PREF: Partial<Record<NotificationType, keyof Omit<EmailNotificationPrefs, 'digest' | 'unsubscribedAll'>>> = {
  like: 'likes',
  comment: 'comments',
  follow: 'follows',
  mention: 'mentions',
};

/**
 * Check whether a user should receive an instant email for a notification type.
 * Returns false if the user has no preferences set, the type has no toggle, or the user disabled it.
 * Also returns false if the user chose digest mode (daily/weekly) — those are batched separately —
 * or has globally unsubscribed.
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
 * Get user email and username for sending notification emails. Returns null unless
 * the address is verified (we never email an unverified address) AND the user has
 * not globally opted out (`unsubscribedAll`). This is the single mailability gate:
 * per-type notification prefs are layered on top by `shouldEmailNotification`, but
 * the hard global opt-out is enforced here so every caller (instant notifications,
 * contest registration confirmations, and any future one) honors it by default.
 */
export async function getNotificationEmailTarget(
  db: DB,
  userId: string,
  allowUnverified = false,
): Promise<{ email: string; username: string } | null> {
  const [row] = await db
    .select({
      email: users.email,
      username: users.username,
      emailVerified: users.emailVerified,
      emailNotifications: users.emailNotifications,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Verified-address gate — skipped when the operator opts into emailing
  // unverified addresses (`features.emailUnverified`); the global opt-out below
  // is always honored.
  if (!row) return null;
  if (!allowUnverified && !row.emailVerified) return null;
  const prefs = (row.emailNotifications ?? undefined) as EmailNotificationPrefs | undefined;
  if (prefs?.unsubscribedAll) return null;
  return { email: row.email, username: row.username };
}
