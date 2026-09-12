import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { contestAnnouncements, contestAnnouncementSends, contestRegistrations, users } from '@commonpub/schema';
import type { ContestAnnouncementAudience } from '@commonpub/schema';
import type { DB } from '../types.js';
import { emailTemplates } from '../email.js';
import { enqueueEmails } from '../comms/outbox.js';
import type { OutboxMessage } from '../comms/outbox.js';
import { buildUnsubscribeLinks } from '../comms/unsubscribe.js';
import { getEmailBranding } from '../comms/branding.js';
import { renderEmailBlocks } from '../emailBlocks.js';
import { nextContestDeadline } from './stages.js';
import { formatDeadlineUtc, humanizeTimeRemaining } from './reminders.js';
import type { ContestEmailContext, StageSource } from './types.js';

/**
 * Contest announcements (session 259) -- the audience half.
 *
 * An organizer composes an arbitrary email and sends it to a contest's
 * participants. THIS module owns the one question every path must answer the
 * same way: who receives it.
 *
 * `audienceWhere` is the single source of truth for that predicate. The recipient
 * COUNT the organizer approves, the rows a send renders, and the claim that
 * inserts the exactly-once ledger all build on it. A second copy would let the
 * count and the send disagree, which is exactly the class of bug where an
 * organizer approves "42 recipients" and 51 people get mail.
 */

/** A recipient, carrying everything a per-recipient render needs. */
export interface AnnouncementRecipient {
  userId: string;
  email: string;
  username: string;
  displayName: string | null;
}

/**
 * The audience predicate: a contest's registrants, narrowed by tier, intersected
 * with the global mailability gate.
 *
 * The mailability half matches `comms/broadcast.ts:audienceWhere` exactly, so a
 * contest announcement can never reach an account the admin blast would skip:
 *  - `status = 'active'` and `deleted_at IS NULL` -- never mail a suspended or
 *    soft-deleted account. (Session 258 found that suspending an account writes
 *    `deletedAt = null`, so both clauses are load-bearing; neither implies the other.)
 *  - a verified address, unless the operator turned on `features.emailUnverified`.
 *  - not globally unsubscribed. `->> 'unsubscribedAll' IS DISTINCT FROM 'true'`
 *    deliberately keeps users with NO prefs row (null) and those who set other
 *    preferences; only an explicit global opt-out excludes.
 *  - not opted out of THIS contest (`contest_registrations.email_opt_out_at`).
 *    Announcements honour it; the registration confirmation and the deadline
 *    reminders do not, because those are transactional.
 *
 * Caller must join `contest_registrations` to `users`; this returns the WHERE.
 */
export function audienceWhere(
  contestId: string,
  audience: ContestAnnouncementAudience,
  allowUnverified: boolean,
): SQL | undefined {
  const conds = [
    eq(contestRegistrations.contestId, contestId),
    isNull(contestRegistrations.emailOptOutAt),
    eq(users.status, 'active'),
    isNull(users.deletedAt),
    sql`(${users.emailNotifications} ->> 'unsubscribedAll') IS DISTINCT FROM 'true'`,
  ];
  if (!allowUnverified) conds.push(eq(users.emailVerified, true));
  // `all` applies no tier filter, matching the deadline-reminder sweep.
  if (audience.tier !== 'all') conds.push(eq(contestRegistrations.tier, audience.tier));
  return and(...conds);
}

/**
 * How many people this audience resolves to. The number an organizer sees before
 * they press send, so it MUST be the same predicate the send uses.
 */
export async function countAnnouncementRecipients(
  db: DB,
  contestId: string,
  audience: ContestAnnouncementAudience,
  allowUnverified = false,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contestRegistrations)
    .innerJoin(users, eq(users.id, contestRegistrations.userId))
    .where(audienceWhere(contestId, audience, allowUnverified));
  return row?.count ?? 0;
}

/**
 * The recipients themselves. Ordered by user id: an arbitrary but TOTAL order, so
 * two reads of an unchanged audience return the same sequence (every orderBy in
 * this repo ends on a unique column for the same reason).
 *
 * Addresses returned here never reach the organizer. The count endpoint returns a
 * number; this is for the server-side render only.
 */
export async function resolveAnnouncementRecipients(
  db: DB,
  contestId: string,
  audience: ContestAnnouncementAudience,
  allowUnverified = false,
): Promise<AnnouncementRecipient[]> {
  return db
    .select({
      userId: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
    })
    .from(contestRegistrations)
    .innerJoin(users, eq(users.id, contestRegistrations.userId))
    .where(audienceWhere(contestId, audience, allowUnverified))
    .orderBy(asc(users.id));
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Every `{token}` an announcement can interpolate.
 *
 * This is the ONE list. The send, the live preview and the test send all build
 * their token map from `announcementTokens` below, so a token cannot exist in a
 * preview and be missing from the real send (or vice versa). The composer shows
 * organizers the same names from `layers/base/utils/contestEmailTokens.ts`,
 * which is a client-side mirror pinned to this list by a parity test.
 */
export const ANNOUNCEMENT_TOKENS = [
  'username',
  'displayName',
  'contestTitle',
  'contestUrl',
  'deadline',
  'timeRemaining',
  'siteName',
  'siteUrl',
] as const;

/** The contest-wide half of the token map, resolved once per send. */
export interface AnnouncementContext {
  siteName: string;
  siteUrl: string;
  contestTitle: string;
  contestUrl: string;
  /** The next upcoming deadline, formatted, or `''` when every deadline has passed. */
  deadline: string;
  /** Time left until that deadline, or `''` when it has passed. */
  timeRemaining: string;
}

/**
 * Resolve the contest-wide tokens, including the STAGE-AWARE deadline (the next
 * upcoming stage, matching what the reminder sweep and the two participation
 * emails resolve). A deadline in the past yields `''` rather than a stale date,
 * so `{deadline}` in a late announcement renders empty instead of lying.
 */
export function announcementContext(
  contest: StageSource & { title: string; slug: string },
  ctx: { siteName: string; siteUrl: string },
  now: Date = new Date(),
): AnnouncementContext {
  const nd = nextContestDeadline(contest, now);
  const msLeft = nd.at.getTime() - now.getTime();
  const future = msLeft > 0;
  return {
    siteName: ctx.siteName,
    siteUrl: ctx.siteUrl,
    contestTitle: contest.title,
    contestUrl: `${ctx.siteUrl}/contests/${contest.slug}`,
    deadline: future ? formatDeadlineUtc(nd.at) : '',
    timeRemaining: future ? humanizeTimeRemaining(msLeft) : '',
  };
}

/** The full token map for one recipient. `displayName` falls back to the
 *  username so `Hi {displayName},` never renders `Hi ,`. */
export function announcementTokens(
  context: AnnouncementContext,
  recipient: { username: string; displayName?: string | null },
): Record<string, string> {
  return {
    username: recipient.username,
    displayName: recipient.displayName || recipient.username,
    contestTitle: context.contestTitle,
    contestUrl: context.contestUrl,
    deadline: context.deadline,
    timeRemaining: context.timeRemaining,
    siteName: context.siteName,
    siteUrl: context.siteUrl,
  };
}

// ---------------------------------------------------------------------------
// The send
// ---------------------------------------------------------------------------

/** Everything a send needs about the announcement and its contest. */
export interface SendContestAnnouncementInput {
  contestId: string;
  /** The contest row. Carries the dates `announcementContext` needs to resolve a
   *  stage-aware `{deadline}`, plus the slug the contest URL is built from. */
  contest: StageSource & { title: string; slug: string };
  /** Organizer-authored subject. Tokenized per recipient. */
  subject: string;
  /** Organizer-authored BlockTuple[] body. */
  bodyBlocks: unknown;
  audience: ContestAnnouncementAudience;
  /** The organizer, for the audit row. */
  sentBy: string;
  /** One key per compose session. A repeat returns the existing announcement and
   *  mails nobody -- the double-click guard (see `duplicate` in the result). */
  idempotencyKey: string;
  /** Abuse bound: refuse when this contest has already sent this many
   *  announcements inside `windowMs`. Checked AFTER the idempotency lookup, so a
   *  client retrying an already-sent announcement gets its result back rather
   *  than a rate-limit error for work it never asked to repeat. Omit to disable. */
  maxPerWindow?: number;
  windowMs?: number;
}

/** Thrown when the abuse bound refuses a send. A distinct class so the route can
 *  map it to 429 without string-matching a generic Error. */
export class AnnouncementRateLimitError extends Error {
  constructor(readonly maxPerWindow: number, readonly windowMs: number) {
    super(`This contest has already sent ${maxPerWindow} announcements in the last ${Math.round(windowMs / 3_600_000)} hours.`);
    this.name = 'AnnouncementRateLimitError';
  }
}

export interface SendContestAnnouncementResult {
  announcementId: string;
  recipientCount: number;
  /** True when this call matched an earlier announcement's idempotency key and
   *  therefore sent nothing. The caller should say "already sent", not "sent". */
  duplicate: boolean;
}

/** Rows per statement, for BOTH the ledger claim and the outbox insert. Keeps one
 *  large audience off a single giant statement, matching the admin broadcast's
 *  chunking. */
const ENQUEUE_CHUNK = 500;

/**
 * CLAIM FIRST. Insert one ledger row per recipient and return ONLY the recipients
 * whose row this call actually created.
 *
 * Why the filter rather than just mailing the resolved list: the ledger is the
 * thing that makes "exactly once per (announcement, recipient)" true. Mailing the
 * resolved list and inserting the ledger alongside it would make the ledger
 * decorative -- a table nobody reads -- and would double-mail anyone the audience
 * resolves twice. `contest_registrations` is UNIQUE on (contest, user) today, so
 * v1's single selector cannot produce a duplicate; the moment the audience becomes
 * a UNION of selectors (entrants, judges, stakeholders, hand-picked), a person who
 * is both a registrant and a judge appears twice and this is what stops them
 * getting two copies. Same idiom as the reminder sweep's milestone claim.
 *
 * Order is preserved: the returned list follows the input order, not the order
 * Postgres happened to return the inserted rows in.
 */
export async function claimAnnouncementRecipients<T extends { userId: string }>(
  tx: DB,
  announcementId: string,
  resolved: readonly T[],
  chunkSize = ENQUEUE_CHUNK,
): Promise<T[]> {
  const claimed = new Set<string>();
  for (let i = 0; i < resolved.length; i += chunkSize) {
    const rows = await tx
      .insert(contestAnnouncementSends)
      .values(resolved.slice(i, i + chunkSize).map((r) => ({ announcementId, userId: r.userId })))
      .onConflictDoNothing()
      .returning({ userId: contestAnnouncementSends.userId });
    for (const row of rows) claimed.add(row.userId);
  }
  // `claimed` is a set, so a duplicate in `resolved` is kept at most once.
  const seen = new Set<string>();
  return resolved.filter((r) => {
    if (!claimed.has(r.userId) || seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
}

/**
 * Send an organizer's announcement to a contest audience.
 *
 * The whole send is ONE transaction: the announcement row, the per-recipient
 * ledger claim, every outbox insert, and the final `sent` stamp. If any part
 * fails, none of it persists and the organizer can simply press send again --
 * rather than the failure mode where an announcement row exists, half the
 * audience was mailed, and a retry double-mails the other half.
 *
 * Exactly-once has two distinct guards because there are two distinct hazards:
 *  - A repeated REQUEST (double-click, a client retry after a timeout) is caught
 *    by the UNIQUE `(contest_id, idempotency_key)`: the second call finds the
 *    first announcement and returns it having mailed nobody.
 *  - A repeated RECIPIENT is caught by the ledger's UNIQUE
 *    `(announcement_id, user_id)`. The claim is CLAIM-FIRST: the insert
 *    `RETURNING`s only the rows it actually created, and ONLY those rows are
 *    mailed. Mailing the resolved list instead would make the ledger decorative
 *    -- a row nobody reads -- and silently double-mail anyone the audience
 *    resolved twice. The ledger is also the audit answer to "did Ada get this?".
 *
 * Rendering happens per recipient, because `{username}` and `{displayName}`
 * differ for each one. Everything else is resolved once, outside the loop.
 */
export async function sendContestAnnouncement(
  db: DB,
  input: SendContestAnnouncementInput,
  ctx: ContestEmailContext,
  chunkSize = ENQUEUE_CHUNK,
  allowUnverified = false,
): Promise<SendContestAnnouncementResult> {
  // Idempotency: a prior announcement under this key already did the work.
  const existing = await db
    .select({ id: contestAnnouncements.id, recipientCount: contestAnnouncements.recipientCount })
    .from(contestAnnouncements)
    .where(
      and(
        eq(contestAnnouncements.contestId, input.contestId),
        eq(contestAnnouncements.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { announcementId: existing[0].id, recipientCount: existing[0].recipientCount, duplicate: true };
  }

  // Only AFTER the idempotency short-circuit above: a retry of an announcement
  // that already went out must return its result, not trip a bound it is not
  // actually adding to.
  if (input.maxPerWindow !== undefined) {
    const windowMs = input.windowMs ?? 24 * 60 * 60 * 1000;
    if ((await countRecentAnnouncements(db, input.contestId, windowMs)) >= input.maxPerWindow) {
      throw new AnnouncementRateLimitError(input.maxPerWindow, windowMs);
    }
  }

  const branding = await getEmailBranding(db);
  const context = announcementContext(input.contest, ctx);
  const contestUrl = context.contestUrl;

  return db.transaction(async (tx) => {
    const [announcement] = await tx
      .insert(contestAnnouncements)
      .values({
        contestId: input.contestId,
        idempotencyKey: input.idempotencyKey,
        subject: input.subject,
        bodyBlocks: input.bodyBlocks,
        audience: input.audience,
        sentById: input.sentBy,
        status: 'sending',
      })
      .returning({ id: contestAnnouncements.id });
    const announcementId = announcement!.id;

    const resolved = await resolveAnnouncementRecipients(tx, input.contestId, input.audience, allowUnverified);

    const recipients = await claimAnnouncementRecipients(tx, announcementId, resolved, chunkSize);

    const messages: OutboxMessage[] = recipients.map((r) => {
      const { pageUrl, headers } = buildUnsubscribeLinks(ctx.siteUrl, r.userId, ctx.secret);
      const tokens = announcementTokens(context, r);
      // siteUrl: an email has no document base, so every block URL must be
      // absolute or a root-relative href lands on a bogus host in the inbox.
      // registrationUrl: a blank registration-link block targets THIS contest's
      // registration page. Every recipient already has an account, so the block's
      // own account-signup default is a dead end.
      const body = renderEmailBlocks(input.bodyBlocks, {
        tokens,
        accent: branding?.accentColor,
        siteUrl: ctx.siteUrl,
        registrationUrl: `${contestUrl}/register`,
      });
      const tpl = emailTemplates.contestAnnouncement({
        siteName: ctx.siteName,
        subject: input.subject,
        contest: { title: context.contestTitle, url: contestUrl },
        bodyHtml: body.html,
        bodyText: body.text,
        tokens,
        unsubscribeUrl: pageUrl,
        branding,
      });
      return {
        toEmail: r.email,
        userId: r.userId,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        headers,
        category: 'announcement' as const,
      };
    });

    for (let i = 0; i < messages.length; i += chunkSize) {
      await enqueueEmails(tx, messages.slice(i, i + chunkSize));
    }

    await tx
      .update(contestAnnouncements)
      .set({ recipientCount: messages.length, status: 'sent', sentAt: new Date() })
      .where(eq(contestAnnouncements.id, announcementId));

    return { announcementId, recipientCount: messages.length, duplicate: false };
  });
}

/** One row of the organizer-facing history list. Deliberately carries no
 *  recipient identities: addresses never travel back to the organizer. */
export interface ContestAnnouncementSummary {
  id: string;
  subject: string;
  recipientCount: number;
  status: string;
  audience: ContestAnnouncementAudience;
  sentAt: Date | null;
  createdAt: Date;
}

/** A contest's announcement history, newest first. `createdAt` alone is not a
 *  total order (two sends can share a timestamp), so the id breaks the tie and
 *  keeps paging stable. */
export async function listContestAnnouncements(
  db: DB,
  contestId: string,
  limit = 20,
): Promise<ContestAnnouncementSummary[]> {
  return db
    .select({
      id: contestAnnouncements.id,
      subject: contestAnnouncements.subject,
      recipientCount: contestAnnouncements.recipientCount,
      status: contestAnnouncements.status,
      audience: contestAnnouncements.audience,
      sentAt: contestAnnouncements.sentAt,
      createdAt: contestAnnouncements.createdAt,
    })
    .from(contestAnnouncements)
    .where(eq(contestAnnouncements.contestId, contestId))
    .orderBy(desc(contestAnnouncements.createdAt), desc(contestAnnouncements.id))
    .limit(Math.min(Math.max(1, limit), 100));
}

/**
 * How many announcements this contest has sent in the last 24 hours.
 *
 * The abuse bound's raw input. A contest organizer is not a platform admin, and
 * the send reaches every registrant's inbox, so the number of blasts per window
 * is capped. Module-private on purpose: `sendContestAnnouncement` is the only
 * thing that should decide whether a send is over the line, and it enforces this
 * in the right order relative to the idempotency short-circuit. Export it only
 * when something real (a "2 of 5 sends used today" hint) needs to read it.
 */
async function countRecentAnnouncements(db: DB, contestId: string, withinMs: number): Promise<number> {
  const since = new Date(Date.now() - withinMs);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contestAnnouncements)
    .where(and(eq(contestAnnouncements.contestId, contestId), gte(contestAnnouncements.createdAt, since)));
  return row?.count ?? 0;
}
