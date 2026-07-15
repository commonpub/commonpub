import { and, eq, desc } from 'drizzle-orm';
import { contests, contestRegistrations, users } from '@commonpub/schema';
import type { ContestRegistrationFields } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { emailTemplates } from '../email.js';
import { enqueueEmail } from '../comms/outbox.js';
import { buildUnsubscribeLinks } from '../comms/unsubscribe.js';
import { getEmailBranding } from '../comms/branding.js';
import { getNotificationEmailTarget } from '../notification/emailPrefs.js';
import { parseContestEmailCopy, buildContestEmailCopyOverride } from './emailCopy.js';
import { formatDeadlineUtc } from './reminders.js';
import type { ContestEmailContext, ContestRegistrantItem } from './types.js';

// Contest registration: a participant's intent to take part, independent of any
// attached content. This is the audience for the registration-confirmation and
// deadline-reminder emails (a contest_entries row requires content, so it can't
// be the audience for a "you registered" / "deadline soon" mail). Instance-local.

// Statuses during which a contest accepts new registrations. `draft` isn't public
// and `judging`/`completed`/`cancelled`/`paused` are past the point of signing up.
const REGISTERABLE_STATUSES = ['upcoming', 'active'] as const;

/** Registration tier: `full` = counted participant; `reminders` = reminders-only opt-in. */
export type ContestRegistrationTier = 'full' | 'reminders';

export interface RegisterForContestResult {
  registered: boolean;
  /** True when the user already had a registration row (idempotent re-register). */
  alreadyRegistered: boolean;
  /** The registration's tier AFTER this call (reflects an upgrade). */
  tier?: ContestRegistrationTier;
  error?: string;
}

/**
 * Register the current user for a contest at a tier (`full` participant, default,
 * or reminders-only), with optional self-reported info. Idempotent + reconciling:
 * a re-register never downgrades a `full` participant to `reminders` (only upgrades
 * reminders→full) and updates `fields` only when a new object is supplied, so an
 * info edit persists and a bare re-register keeps prior info. On a GENUINELY NEW
 * registration, and only when `emailNotifications` is on, an email context is
 * supplied, and the target is mailable, a confirmation email is ENQUEUED — never
 * on a re-register/upgrade, to avoid duplicate mail. The email is best-effort: a
 * send-path failure never fails the registration write.
 */
export async function registerForContest(
  db: DB,
  config: CommonPubConfig,
  input: { contestId: string; userId: string; tier?: ContestRegistrationTier; fields?: ContestRegistrationFields },
  email?: ContestEmailContext,
): Promise<RegisterForContestResult> {
  const tier: ContestRegistrationTier = input.tier ?? 'full';
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

  // Claim a new row. onConflictDoNothing distinguishes a genuine first-time
  // registration (row returned → send the confirmation) from a re-register (no
  // row → reconcile tier/fields below, no email).
  const [inserted] = await db
    .insert(contestRegistrations)
    .values({ contestId: input.contestId, userId: input.userId, tier, fields: input.fields })
    .onConflictDoNothing()
    .returning({ id: contestRegistrations.id });

  if (!inserted) {
    // Existing registration: upgrade reminders→full (never downgrade) and update
    // fields only when a new object is supplied. Skip the write entirely when
    // there is nothing to change, then report the current tier.
    const upgrade = tier === 'full';
    const set: Partial<{ tier: ContestRegistrationTier; fields: ContestRegistrationFields | null }> = {};
    if (upgrade) set.tier = 'full';
    if (input.fields !== undefined) set.fields = input.fields;

    let finalTier: ContestRegistrationTier;
    if (Object.keys(set).length > 0) {
      const [updated] = await db
        .update(contestRegistrations)
        .set(set)
        .where(and(eq(contestRegistrations.contestId, input.contestId), eq(contestRegistrations.userId, input.userId)))
        .returning({ tier: contestRegistrations.tier });
      finalTier = (updated?.tier as ContestRegistrationTier) ?? tier;
    } else {
      const [row] = await db
        .select({ tier: contestRegistrations.tier })
        .from(contestRegistrations)
        .where(and(eq(contestRegistrations.contestId, input.contestId), eq(contestRegistrations.userId, input.userId)))
        .limit(1);
      finalTier = (row?.tier as ContestRegistrationTier) ?? tier;
    }
    return { registered: false, alreadyRegistered: true, tier: finalTier };
  }

  // Confirmation email (best-effort). Gated on emailNotifications + a supplied
  // email context + a mailable target (verified AND not globally unsubscribed,
  // enforced by getNotificationEmailTarget), never on the reminders flag.
  if (config.features.emailNotifications && email) {
    try {
      const target = await getNotificationEmailTarget(db, input.userId, config.features.emailUnverified);
      if (target) {
        const { pageUrl, headers } = buildUnsubscribeLinks(email.siteUrl, input.userId, email.secret);
        const branding = await getEmailBranding(db);
        // Apply the per-contest copy override only when the editor feature is on,
        // so turning the flag off reverts every send to the built-in default.
        const copyField = config.features.contestEmailEditor ? parseContestEmailCopy(contest.emailCopy).confirmation : undefined;
        const contestUrl = `${email.siteUrl}/contests/${contest.slug}`;
        const deadline = formatDeadlineUtc(contest.endDate);
        // Render the block body (if any) to email-safe HTML with this recipient's tokens.
        const copy = buildContestEmailCopyOverride(copyField, {
          tokens: { username: target.username, contestTitle: contest.title, deadline, contestUrl },
          accent: branding?.accentColor,
        });
        const tpl = emailTemplates.contestRegistrationConfirmation(
          email.siteName,
          target.username,
          { title: contest.title, url: contestUrl, deadline },
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

  return { registered: true, alreadyRegistered: false, tier };
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

/** Whether a user is registered for a contest (either tier). */
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

/**
 * The viewer's own registration for a contest — tier + collected info — or null
 * when not registered. Drives the signup card's exact state (full vs reminders)
 * and prefills the optional info form. Cheap single-row read.
 */
export async function getViewerRegistration(
  db: DB,
  contestId: string,
  userId: string,
): Promise<{ tier: ContestRegistrationTier; fields: ContestRegistrationFields | null } | null> {
  const [row] = await db
    .select({ tier: contestRegistrations.tier, fields: contestRegistrations.fields })
    .from(contestRegistrations)
    .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { tier: (row.tier as ContestRegistrationTier) ?? 'full', fields: row.fields ?? null };
}

/** Paginated list of a contest's registrants (newest first). Privileged read. */
export async function listContestRegistrants(
  db: DB,
  contestId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: ContestRegistrantItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  // Only `full` participants are "registrants" (reminders-only opt-ins are a
  // separate, larger reminder audience); the count below matches this filter.
  const where = and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.tier, 'full'));
  const [rows, total] = await Promise.all([
    db
      .select({
        userId: contestRegistrations.userId,
        registeredAt: contestRegistrations.createdAt,
        fields: contestRegistrations.fields,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(contestRegistrations)
      .innerJoin(users, eq(contestRegistrations.userId, users.id))
      .where(where)
      // createdAt is not unique; the id tiebreaker keeps pagination stable.
      .orderBy(desc(contestRegistrations.createdAt), desc(contestRegistrations.id))
      .limit(limit)
      .offset(offset),
    countRows(db, contestRegistrations, where),
  ]);

  return {
    items: rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      registeredAt: r.registeredAt,
      fields: r.fields ?? null,
    })),
    total,
  };
}

/** Number of `full` participants registered for a contest (excludes reminders-only opt-ins). */
export async function getRegistrantCount(db: DB, contestId: string): Promise<number> {
  return countRows(
    db,
    contestRegistrations,
    and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.tier, 'full')),
  );
}
