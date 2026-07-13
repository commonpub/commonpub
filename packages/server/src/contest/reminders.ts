import { and, gte, lte, inArray, sql } from 'drizzle-orm';
import { contests } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { emailTemplates } from '../email.js';
import { enqueueEmails } from '../comms/outbox.js';
import type { OutboxMessage } from '../comms/outbox.js';
import { buildUnsubscribeLinks } from '../comms/unsubscribe.js';
import { getEmailBranding } from '../comms/branding.js';
import { parseContestEmailCopy } from './emailCopy.js';
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
  const horizon = new Date(now.getTime() + MAX_LEAD_MS);

  // Contests still open for submission whose deadline is within the widest lead
  // window. One row set, then we decide per-milestone below.
  const due = await db
    .select({
      id: contests.id,
      title: contests.title,
      slug: contests.slug,
      endDate: contests.endDate,
      emailCopy: contests.emailCopy,
    })
    .from(contests)
    .where(and(
      inArray(contests.status, ['upcoming', 'active']),
      gte(contests.endDate, now),
      lte(contests.endDate, horizon),
    ));

  if (due.length === 0) return { contests: 0, enqueued: 0 };

  const branding = await getEmailBranding(db);
  // Milestones tightest-first: the FIRST whose window the deadline has entered is
  // the single most-urgent one to send.
  const byUrgency = [...CONTEST_REMINDER_MILESTONES].reverse();
  let enqueued = 0;

  for (const contest of due) {
    const msLeft = contest.endDate.getTime() - now.getTime();

    // Fire only the SINGLE tightest milestone whose window the deadline has
    // entered (smallest leadMs with msLeft <= leadMs). Firing every entered
    // milestone at once would send a BURST to anyone who registered late — or to
    // a contest whose whole active window is shorter than the widest milestone —
    // several mails landing together. The per-milestone ledger still guarantees
    // exactly-once, and the next-tighter milestone fires on a later sweep as the
    // deadline nears. `timeRemaining` below is the ACTUAL remaining time, never
    // the milestone's nominal name, so a late fire never states a wrong number.
    const milestone = byUrgency.find((m) => msLeft <= m.leadMs);
    if (!milestone) continue; // beyond the widest window (already bounded out by `due`; defensive)

    const contestUrl = `${ctx.siteUrl}/contests/${contest.slug}`;
    const deadline = formatDeadlineUtc(contest.endDate);
    const timeRemaining = humanizeTimeRemaining(msLeft);
    // Apply the per-contest reminder copy override only when the editor feature
    // is on; otherwise every reminder uses the built-in default copy.
    const reminderCopy = config.features.contestEmailEditor ? parseContestEmailCopy(contest.emailCopy).reminder : undefined;

    // Atomic claim: insert one ledger row per eligible (verified, not globally
    // unsubscribed) registrant and return only the rows we actually inserted,
    // joined back to the user so we can address the mail in the same round-trip.
    // Raw SQL: an `INSERT ... SELECT ... ON CONFLICT DO NOTHING RETURNING` fed
    // into a CTE join is not expressible in the drizzle query builder.
    const res = await db.execute(sql`
      WITH claimed AS (
        INSERT INTO contest_reminder_sends (contest_id, user_id, milestone)
        SELECT cr.contest_id, cr.user_id, ${milestone.key}
        FROM contest_registrations cr
        INNER JOIN users u ON u.id = cr.user_id
        WHERE cr.contest_id = ${contest.id}
          AND u.email_verified = true
          AND (u.email_notifications ->> 'unsubscribedAll') IS DISTINCT FROM 'true'
        ON CONFLICT (contest_id, user_id, milestone) DO NOTHING
        RETURNING user_id
      )
      SELECT c.user_id AS "userId", u.email AS "email", u.username AS "username"
      FROM claimed c
      INNER JOIN users u ON u.id = c.user_id
    `);

    const recipients = rowsOf<{ userId: string; email: string; username: string }>(res);
    if (recipients.length === 0) continue;

    const messages: OutboxMessage[] = recipients.map((r) => {
      const { pageUrl, headers } = buildUnsubscribeLinks(ctx.siteUrl, r.userId, ctx.secret);
      const tpl = emailTemplates.contestDeadlineReminder(
        ctx.siteName,
        r.username,
        { title: contest.title, url: contestUrl, deadline, timeRemaining },
        pageUrl,
        branding,
        reminderCopy,
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

    await enqueueEmails(db, messages);
    enqueued += messages.length;
  }

  return { contests: due.length, enqueued };
}
