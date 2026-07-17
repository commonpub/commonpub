import { and, eq, desc } from 'drizzle-orm';
import { contests, contestRegistrations, users } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';
import { nextContestDeadline } from './stages.js';
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
  input: { contestId: string; userId: string; tier?: ContestRegistrationTier; fields?: Record<string, string> },
  email?: ContestEmailContext,
): Promise<RegisterForContestResult> {
  const tier: ContestRegistrationTier = input.tier ?? 'full';
  const [contest] = await db
    .select({
      id: contests.id,
      status: contests.status,
      title: contests.title,
      slug: contests.slug,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
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

  // The participant-confirmation email ("You are now registered for …"). Best-effort,
  // gated on emailNotifications + a supplied email context + a mailable target
  // (verified-or-emailUnverified AND not globally unsubscribed). Fired ONLY when a
  // user becomes a FULL participant — a genuine full registration OR a reminders→full
  // upgrade — never for a reminders-only opt-in, whose UI + the participant count say
  // they are not a participant; sending "you are registered" there would be a lie.
  // Bind the already-null-checked contest so the closure captures a non-nullable
  // reference (TS widens outer-scope narrowing back inside a nested function).
  const contestRow = contest;
  async function sendParticipantConfirmation(): Promise<void> {
    if (!(config.features.emailNotifications && email)) return;
    try {
      const target = await getNotificationEmailTarget(db, input.userId, config.features.emailUnverified);
      if (!target) return;
      const { pageUrl, headers } = buildUnsubscribeLinks(email.siteUrl, input.userId, email.secret);
      const branding = await getEmailBranding(db);
      // Apply the per-contest copy override only when the editor feature is on,
      // so turning the flag off reverts every send to the built-in default.
      const copyField = config.features.contestEmailEditor ? parseContestEmailCopy(contestRow.emailCopy).confirmation : undefined;
      const contestUrl = `${email.siteUrl}/contests/${contestRow.slug}`;
      // Stage-aware: for a staged contest the confirmation shows the NEXT upcoming
      // stage deadline (e.g. the proposal submission), not the far-off final date.
      // Only show it when it's in the FUTURE — a contest can sit in `active` after
      // its endDate passed (status not yet advanced), and stating a past "deadline
      // is …" to a new registrant is worse than omitting it (the template then
      // reads "we'll send you reminders as the deadline approaches").
      const nd = nextContestDeadline(contestRow, new Date());
      const deadline = nd.at.getTime() > Date.now() ? formatDeadlineUtc(nd.at) : '';
      // Render the block body (if any) to email-safe HTML with this recipient's tokens.
      const copy = buildContestEmailCopyOverride(copyField, {
        tokens: { username: target.username, contestTitle: contestRow.title, deadline, contestUrl },
        accent: branding?.accentColor,
      });
      const tpl = emailTemplates.contestRegistrationConfirmation(
        email.siteName,
        target.username,
        { title: contestRow.title, url: contestUrl, deadline },
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
    } catch (err) {
      console.error('[contest-registration] confirmation email enqueue failed:', err instanceof Error ? err.message : err);
    }
  }

  // Claim a new row. onConflictDoNothing distinguishes a genuine first-time
  // registration (row returned) from a re-register (no row → reconcile below).
  const [inserted] = await db
    .insert(contestRegistrations)
    .values({ contestId: input.contestId, userId: input.userId, tier, fields: input.fields })
    .onConflictDoNothing()
    .returning({ id: contestRegistrations.id });

  if (!inserted) {
    // Existing registration. Read the prior tier so we can (a) upgrade
    // reminders→full without ever downgrading and (b) know when this call is the
    // moment the user becomes a participant (so we confirm then, not before).
    const [existing] = await db
      .select({ tier: contestRegistrations.tier })
      .from(contestRegistrations)
      .where(and(eq(contestRegistrations.contestId, input.contestId), eq(contestRegistrations.userId, input.userId)))
      .limit(1);
    const priorTier = (existing?.tier as ContestRegistrationTier) ?? 'full';

    // Update fields only when a new object is supplied; upgrade tier only on a
    // genuine reminders→full transition. Skip the write when nothing changes.
    const set: Partial<{ tier: ContestRegistrationTier; fields: Record<string, string> | null }> = {};
    if (tier === 'full' && priorTier !== 'full') set.tier = 'full';
    if (input.fields !== undefined) set.fields = input.fields;

    let finalTier: ContestRegistrationTier = priorTier;
    if (Object.keys(set).length > 0) {
      const [updated] = await db
        .update(contestRegistrations)
        .set(set)
        .where(and(eq(contestRegistrations.contestId, input.contestId), eq(contestRegistrations.userId, input.userId)))
        .returning({ tier: contestRegistrations.tier });
      finalTier = (updated?.tier as ContestRegistrationTier) ?? finalTier;
    }

    // A reminders→full upgrade is the moment they become a participant. The
    // first-insert path never confirmed the reminders row, so confirm now.
    if (priorTier !== 'full' && finalTier === 'full') await sendParticipantConfirmation();
    return { registered: false, alreadyRegistered: true, tier: finalTier };
  }

  // Genuine first registration. Only a FULL registration gets the participant
  // confirmation; a reminders-only opt-in deliberately gets none.
  if (tier === 'full') await sendParticipantConfirmation();
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
): Promise<{ tier: ContestRegistrationTier; fields: Record<string, string> | null } | null> {
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
