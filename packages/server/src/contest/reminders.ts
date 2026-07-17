import { and, gte, inArray, sql } from 'drizzle-orm';
import { contests } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { nextContestDeadline } from './stages.js';
import { emailTemplates } from '../email.js';
import { enqueueEmails } from '../comms/outbox.js';
import type { OutboxMessage } from '../comms/outbox.js';
import { buildUnsubscribeLinks } from '../comms/unsubscribe.js';
import { getEmailBranding } from '../comms/branding.js';
import { parseContestEmailCopy, buildContestEmailCopyOverride } from './emailCopy.js';
import type { ContestEmailContext } from './types.js';

// Automatic contest deadline reminders. A single sweep, safe to run on every
// replica, walks the contests whose submission deadline is approaching and, for
// each REGISTERED + verified + not-unsubscribed participant, claims a per
// (contest, participant, milestone) ledger row and enqueues one reminder email.
// The UNIQUE claim (`INSERT ... ON CONFLICT DO NOTHING RETURNING`) guarantees a
// milestone is delivered exactly once per participant across ticks and replicas.

/**
 * Deadline milestones, longest lead first. A milestone fires for a contest the
 * moment its deadline enters that milestone's lead window (`endDate - now <=
 * leadMs`) and has not yet passed (`endDate >= now`). Because the ledger claims
 * each (contest, participant, milestone) once, the natural cadence is: the 7-day
 * mail goes out ~7 days before, the 48-hour mail ~48 hours before, and so on.
 * `label` is the milestone's NOMINAL name (for logs/tests); the copy that
 * actually ships states the real remaining time via `humanizeTimeRemaining`, so
 * a milestone that fires late never claims a wrong number.
 */
export const CONTEST_REMINDER_MILESTONES = [
  { key: 'deadline_T7d', leadMs: 7 * 24 * 60 * 60 * 1000, label: '7 days' },
  { key: 'deadline_T48h', leadMs: 48 * 60 * 60 * 1000, label: '48 hours' },
  { key: 'deadline_T24h', leadMs: 24 * 60 * 60 * 1000, label: '24 hours' },
  { key: 'deadline_T1h', leadMs: 60 * 60 * 1000, label: '1 hour' },
] as const;

const MAX_LEAD_MS = Math.max(...CONTEST_REMINDER_MILESTONES.map((m) => m.leadMs));

/**
 * Human-readable time remaining, derived from the ACTUAL milliseconds left, not
 * from the milestone name. A milestone is only an exactly-once ledger key + a
 * "which window did the deadline enter" trigger; the copy must state the true
 * remaining time, or a reminder that fires late (email enabled close to the
 * deadline, or a participant who registered mid-window) would claim a wrong
 * number (e.g. "7 days left" with hours to go). Snaps to whole minutes/hours/
 * days: `1 minute`, `48 hours`, `6 days`. Hours up to 48 so the 48h/24h/1h
 * milestones read as "48 hours"/"24 hours"/"1 hour" when they fire on schedule.
 */
export function humanizeTimeRemaining(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours <= 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Human-readable UTC deadline, e.g. `July 19, 2026 at 14:00 UTC`. */
export function formatDeadlineUtc(date: Date): string {
  // Assemble from parts so the output is STABLE across ICU versions. Older ICU
  // renders "July 19, 2026, 14:00" (two commas); newer ICU (Node 18+/modern V8)
  // renders "July 19, 2026 at 14:00" (one comma + native " at "). A regex that
  // rewrites "the last comma" into " at" mangles the newer form into
  // "July 19 at 2026 at 14:00". Building it by field avoids that entirely.
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')} ${get('day')}, ${get('year')} at ${get('hour')}:${get('minute')} UTC`;
}

/** drizzle's raw `execute` returns rows on `.rows` (node-postgres) or directly as an array (pglite). */
function rowsOf<T>(res: unknown): T[] {
  const withRows = res as { rows?: T[] };
  return Array.isArray(withRows.rows) ? withRows.rows : (res as T[]);
}

export interface SweepContestRemindersContext extends ContestEmailContext {
  /** Injectable clock for tests (defaults to now). */
  now?: Date;
}

export interface SweepContestRemindersResult {
  /** Contests inspected this sweep (deadline within the widest lead window). */
  contests: number;
  /** Reminder emails newly claimed + enqueued. */
  enqueued: number;
}

/**
 * One reminder sweep. Gated by BOTH `emailNotifications` (the outbox worker only
 * drains when it is on) AND `contestReminders`; returns early with a zero result
 * when either is off, so it is inert until an operator opts in. `now` is
 * injectable so the milestone math is deterministic in tests.
 */
export async function sweepContestReminders(
  db: DB,
  config: CommonPubConfig,
  ctx: SweepContestRemindersContext,
): Promise<SweepContestRemindersResult> {
  if (!config.features.emailNotifications || !config.features.contestReminders) {
    return { contests: 0, enqueued: 0 };
  }

  const now = ctx.now ?? new Date();
  const byUrgency = [...CONTEST_REMINDER_MILESTONES].reverse();

  // Phase 1 — LIGHT load: only the columns nextContestDeadline needs, for every
  // live contest (final deadline not yet past). We can't SQL-filter on a per-stage
  // `endsAt` (it lives in the `stages` jsonb), so we resolve each contest's next
  // upcoming submission deadline in JS and keep only those inside the widest lead
  // window. The heavy `emailCopy` (organizer block bodies) is deferred to phase 2
  // so a far-off contest we immediately skip never loads it.
  const liveLite = await db
    .select({
      id: contests.id,
      status: contests.status,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
    })
    .from(contests)
    .where(and(
      inArray(contests.status, ['upcoming', 'active']),
      gte(contests.endDate, now),
    ));

  // Resolve each live contest's stage-aware target (the next upcoming submission
  // deadline — proposal, then prototype, …, falling back to the final endDate)
  // and keep only those whose deadline has entered a milestone's lead window.
  const due = liveLite
    .map((c) => {
      const target = nextContestDeadline(c, now);
      const msLeft = target.at.getTime() - now.getTime();
      return { id: c.id, target, msLeft };
    })
    .filter((d) => d.msLeft > 0 && d.msLeft <= MAX_LEAD_MS)
    .map((d) => ({ ...d, milestone: byUrgency.find((m) => d.msLeft <= m.leadMs) }))
    .filter((d): d is typeof d & { milestone: (typeof byUrgency)[number] } => !!d.milestone);

  if (due.length === 0) return { contests: 0, enqueued: 0 };

  // Phase 2 — HEAVY load: title/slug + the organizer emailCopy override, only for
  // the handful of contests that survived the window filter.
  const detailRows = await db
    .select({ id: contests.id, title: contests.title, slug: contests.slug, emailCopy: contests.emailCopy })
    .from(contests)
    .where(inArray(contests.id, due.map((d) => d.id)));
  const detailById = new Map(detailRows.map((r) => [r.id, r]));

  const branding = await getEmailBranding(db);
  let enqueued = 0;

  for (const { id, target, msLeft, milestone } of due) {
    const contest = detailById.get(id);
    if (!contest) continue;

    // Fire the SINGLE tightest milestone whose window the deadline has entered
    // (chosen above). The per-milestone ledger guarantees exactly-once; the
    // next-tighter milestone fires on a later sweep. `timeRemaining` is the ACTUAL
    // time left, never the milestone's nominal name, so a late fire never lies.
    //
    // Per-STAGE exactly-once: an EXPLICIT stage deadline gets its own scoped key so
    // each stage runs its own 7d/48h/24h/1h cycle; a classic/own-deadline contest
    // keeps the historical UN-scoped key (`isOwnDeadline` is derived from stage
    // PROVENANCE, not the id string). `legacyGuard` additionally treats a prior
    // send under the old un-scoped key as already delivered when we're now scoping,
    // so the un-scoped→scoped transition (e.g. the session-240 deploy) never
    // re-fires a milestone a registrant already received.
    const milestoneKey = target.isOwnDeadline ? milestone.key : `${target.stageId}:${milestone.key}`;
    const legacyGuard = target.isOwnDeadline
      ? sql``
      : sql`AND NOT EXISTS (SELECT 1 FROM contest_reminder_sends x WHERE x.contest_id = cr.contest_id AND x.user_id = cr.user_id AND x.milestone = ${milestone.key})`;

    const contestUrl = `${ctx.siteUrl}/contests/${contest.slug}`;
    const deadline = formatDeadlineUtc(target.at);
    const timeRemaining = humanizeTimeRemaining(msLeft);
    // Apply the per-contest reminder copy override only when the editor feature
    // is on; otherwise every reminder uses the built-in default copy.
    const reminderField = config.features.contestEmailEditor ? parseContestEmailCopy(contest.emailCopy).reminder : undefined;

    // Atomic claim: insert one ledger row per eligible (verified, not globally
    // unsubscribed) registrant and return only the rows we actually inserted,
    // joined back to the user so we can address the mail in the same round-trip.
    // Raw SQL: an `INSERT ... SELECT ... ON CONFLICT DO NOTHING RETURNING` fed
    // into a CTE join is not expressible in the drizzle query builder.
    // Claim + enqueue in ONE transaction: if enqueueEmails throws, the ledger
    // claim rolls back so a later sweep retries the milestone, instead of
    // committing the claim and permanently dropping the whole batch's reminder
    // (the documented exactly-once silently degrading to at-most-once/zero).
    // The try/catch is essential: without it a DETERMINISTIC per-contest failure
    // would roll back + rethrow out of the loop and, because the claim rolled back,
    // re-throw every tick — starving every contest ordered after it. Isolate the
    // failure to its own contest and continue.
    try {
    await db.transaction(async (tx) => {
    const res = await tx.execute(sql`
      WITH claimed AS (
        INSERT INTO contest_reminder_sends (contest_id, user_id, milestone)
        SELECT cr.contest_id, cr.user_id, ${milestoneKey}
        FROM contest_registrations cr
        INNER JOIN users u ON u.id = cr.user_id
        WHERE cr.contest_id = ${id}
          ${config.features.emailUnverified ? sql`` : sql`AND u.email_verified = true`}
          AND (u.email_notifications ->> 'unsubscribedAll') IS DISTINCT FROM 'true'
          ${legacyGuard}
        ON CONFLICT (contest_id, user_id, milestone) DO NOTHING
        RETURNING user_id
      )
      SELECT c.user_id AS "userId", u.email AS "email", u.username AS "username"
      FROM claimed c
      INNER JOIN users u ON u.id = c.user_id
    `);

    const recipients = rowsOf<{ userId: string; email: string; username: string }>(res);
    if (recipients.length === 0) return;

    const messages: OutboxMessage[] = recipients.map((r) => {
      const { pageUrl, headers } = buildUnsubscribeLinks(ctx.siteUrl, r.userId, ctx.secret);
      // Render the block body (if any) per-recipient so `{username}` resolves to
      // each participant; the rest of the tokens are contest-wide.
      const copy = buildContestEmailCopyOverride(reminderField, {
        tokens: { username: r.username, contestTitle: contest.title, deadline, timeRemaining, contestUrl },
        accent: branding?.accentColor,
      });
      const tpl = emailTemplates.contestDeadlineReminder(
        ctx.siteName,
        r.username,
        { title: contest.title, url: contestUrl, deadline, timeRemaining },
        pageUrl,
        branding,
        copy,
      );
      return {
        toEmail: r.email,
        userId: r.userId,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        headers,
        category: 'reminder',
      };
    });

    await enqueueEmails(tx, messages);
    enqueued += messages.length;
    });
    } catch (err) {
      // Rollback already un-claimed this contest's rows, so the next sweep retries;
      // skip it now rather than aborting the whole sweep (poison-pill isolation).
      console.error(`[contest-reminders] sweep failed for contest ${id} milestone ${milestoneKey}:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  return { contests: due.length, enqueued };
}
