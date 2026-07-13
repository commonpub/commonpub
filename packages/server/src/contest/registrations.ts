import { and, eq, desc } from 'drizzle-orm';
import { contests, contestRegistrations, users } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { emailTemplates } from '../email.js';
import { enqueueEmail } from '../comms/outbox.js';
import { buildUnsubscribeLinks } from '../comms/unsubscribe.js';
import { getEmailBranding } from '../comms/branding.js';
import { getNotificationEmailTarget } from '../notification/emailPrefs.js';
import { parseContestEmailCopy } from './emailCopy.js';
import { formatDeadlineUtc } from './reminders.js';
import type { ContestEmailContext, ContestRegistrantItem } from './types.js';

// Contest registration: a participant's intent to take part, independent of any
// attached content. This is the audience for the registration-confirmation and
// deadline-reminder emails (a contest_entries row requires content, so it can't
// be the audience for a "you registered" / "deadline soon" mail). Instance-local.

// Statuses during which a contest accepts new registrations. `draft` isn't public
// and `judging`/`completed`/`cancelled`/`paused` are past the point of signing up.
const REGISTERABLE_STATUSES = ['upcoming', 'active'] as const;

export interface RegisterForContestResult {
  registered: boolean;
  /** True when the user already had a registration row (idempotent re-register). */
  alreadyRegistered: boolean;
  error?: string;
}

/**
 * Register the current user for a contest. Idempotent: a second call is a no-op
 * that reports `alreadyRegistered`. On a genuinely new registration, and only
 * when `emailNotifications` is on, an email context is supplied, and the user's
 * address is verified, a confirmation email is ENQUEUED (mirrors the notification
 * target check). The email is best-effort: a send-path failure never fails the
 * registration write.
 */
export async function registerForContest(
  db: DB,
  config: CommonPubConfig,
  input: { contestId: string; userId: string },
  email?: ContestEmailContext,
): Promise<RegisterForContestResult> {
  const [contest] = await db
    .select({
      id: contests.id,
      status: contests.status,
      title: contests.title,
      slug: contests.slug,
      endDate: contests.endDate,
      emailCopy: contests.emailCopy,
    })
    .from(contests)
    .where(eq(contests.id, input.contestId))
    .limit(1);

  if (!contest) {
    return { registered: false, alreadyRegistered: false, error: 'Contest not found' };
  }
  if (!(REGISTERABLE_STATUSES as readonly string[]).includes(contest.status)) {
    return { registered: false, alreadyRegistered: false, error: 'Contest is not open for registration' };
  }

  const [inserted] = await db
    .insert(contestRegistrations)
    .values({ contestId: input.contestId, userId: input.userId })
    .onConflictDoNothing()
    .returning({ id: contestRegistrations.id });

  if (!inserted) {
    return { registered: false, alreadyRegistered: true };
  }

  // Confirmation email (best-effort). Gated on emailNotifications + a supplied
  // email context + a mailable target (verified AND not globally unsubscribed,
  // enforced by getNotificationEmailTarget), never on the reminders flag.
  if (config.features.emailNotifications && email) {
    try {
      const target = await getNotificationEmailTarget(db, input.userId);
      if (target) {
        const { pageUrl, headers } = buildUnsubscribeLinks(email.siteUrl, input.userId, email.secret);
        const branding = await getEmailBranding(db);
        // Apply the per-contest copy override only when the editor feature is on,
        // so turning the flag off reverts every send to the built-in default.
        const copy = config.features.contestEmailEditor ? parseContestEmailCopy(contest.emailCopy).confirmation : undefined;
        const tpl = emailTemplates.contestRegistrationConfirmation(
          email.siteName,
          target.username,
          {
            title: contest.title,
            url: `${email.siteUrl}/contests/${contest.slug}`,
            deadline: formatDeadlineUtc(contest.endDate),
          },
          pageUrl,
          branding,
          copy,
        );
        await enqueueEmail(db, {
          toEmail: target.email,
          userId: input.userId,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          headers,
          category: 'reminder',
        });
      }
    } catch (err) {
      console.error('[contest-registration] confirmation email enqueue failed:', err instanceof Error ? err.message : err);
    }
  }

  return { registered: true, alreadyRegistered: false };
}

/** Cancel a user's registration. Returns whether a row was removed. */
export async function unregisterForContest(
  db: DB,
  contestId: string,
  userId: string,
): Promise<{ unregistered: boolean }> {
  const deleted = await db
    .delete(contestRegistrations)
    .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)))
    .returning({ id: contestRegistrations.id });
  return { unregistered: deleted.length > 0 };
}

/** Whether a user is registered for a contest. */
export async function isRegisteredForContest(
  db: DB,
  contestId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: contestRegistrations.id })
    .from(contestRegistrations)
    .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)))
    .limit(1);
  return !!row;
}

/** Paginated list of a contest's registrants (newest first). Privileged read. */
export async function listContestRegistrants(
  db: DB,
  contestId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: ContestRegistrantItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  const [rows, total] = await Promise.all([
    db
      .select({
        userId: contestRegistrations.userId,
        registeredAt: contestRegistrations.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(contestRegistrations)
      .innerJoin(users, eq(contestRegistrations.userId, users.id))
      .where(eq(contestRegistrations.contestId, contestId))
      // createdAt is not unique; the id tiebreaker keeps pagination stable.
      .orderBy(desc(contestRegistrations.createdAt), desc(contestRegistrations.id))
      .limit(limit)
      .offset(offset),
    countRows(db, contestRegistrations, eq(contestRegistrations.contestId, contestId)),
  ]);

  return {
    items: rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      registeredAt: r.registeredAt,
    })),
    total,
  };
}

/** Number of participants registered for a contest. */
export async function getRegistrantCount(db: DB, contestId: string): Promise<number> {
  return countRows(db, contestRegistrations, eq(contestRegistrations.contestId, contestId));
}
