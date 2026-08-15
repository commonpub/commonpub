/**
 * GET /api/admin/data-sharing/disclosures?months=12
 *
 * The disclosure panel (member-visibility plan section 6, third bullet):
 * MEMBERS DISCLOSED PER RECIPIENT PER MONTH, so bulk extraction is visible
 * without reading the table.
 *
 * Two numbers per (recipient, month), and both are needed:
 *
 *   `members`     distinct people disclosed. This is the extraction figure.
 *                 One recipient pulling 400 distinct members out of a 500
 *                 person instance is the thing an operator has to be able to
 *                 see, and it is invisible in a raw row count.
 *   `disclosures` rows written. A repeat pull is a repeat disclosure and the
 *                 table has no unique constraint on (recipient, member) for
 *                 exactly that reason, so this is the polling figure: the same
 *                 30 members pulled hourly is a different behaviour from 30
 *                 pulled once, and only the ratio of these two shows it.
 *
 * ISOLATION (plan D1). This route reads `disclosure_events` and nothing else. It
 * does not import, call or reimplement anything from the aggregate metrics
 * pipeline: no k-anonymity floor, no suppression, no quantisation. That is
 * correct and it is the whole distinction the plan draws. `persona_metrics_daily`
 * exists to make individuals unidentifiable; `disclosure_events` exists to make a
 * named recipient's reading of named, consenting individuals accountable, and
 * suppressing a recipient's disclosure count below a floor would suppress exactly
 * the evidence the operator needs. Counting rows in an accountability log is not
 * publishing a cohort.
 *
 * ONE PERMISSION FOR ONE PAGE. `settings.manage`, matching the recipients CRUD
 * beside it rather than `audit.read` as `/api/admin/persona-metrics` uses. The
 * operator who can name a recipient is exactly the one who has to see what that
 * recipient pulled, and splitting the two halves of `/admin/data-sharing` across
 * two permission keys would render half a screen to somebody holding one of
 * them.
 *
 * NO MEMBER IDENTITIES. Counts only. Which specific members a recipient saw is
 * the MEMBER'S record, served to them on `/settings/privacy` (plan D6), and an
 * operator screen listing "Acme Robotics has seen: alice, bob, carol" would turn
 * an accountability log into a second directory.
 *
 * The window is bounded by `dataSharing.disclosureRetentionYears`: the purge job
 * deletes rows older than that, so asking for more months than the retention
 * window can hold would render empty columns that look like a drop in activity.
 * The response reports the retention so the page can say where the record stops.
 */
import { disclosureEvents } from '@commonpub/schema';
import { effectiveRecipients } from '@commonpub/server';
import { gte, sql } from 'drizzle-orm';
import { z } from 'zod';
// Owned by `@commonpub/persona`, not on the server barrel. See the note in
// `recipients.get.ts`; `layers/base` declares the dependency directly.
import { dataSharingConfigSchema } from '@commonpub/persona';

/** How far back the panel may look. Two years of months is already a wide table. */
const MAX_MONTHS = 24;
const DEFAULT_MONTHS = 12;

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(MAX_MONTHS).default(DEFAULT_MONTHS),
});

export interface DisclosureMonthCell {
  /** `YYYY-MM`, UTC. */
  month: string;
  /** Distinct members disclosed to this recipient in this month. */
  members: number;
  /** Rows written. Higher than `members` when the recipient re-pulled. */
  disclosures: number;
}

export interface DisclosureRecipientRow {
  recipientId: string;
  /**
   * The recipient's declared name, or null when nothing declares that id any
   * more. A null name is not a data error: a recipient that has been REMOVED
   * from both the config file and the database keeps its disclosure history,
   * because the disclosures happened, and the panel must keep showing them
   * rather than dropping the row and quietly shrinking the record.
   */
  name: string | null;
  /** True when neither the config file nor the database declares this id now. */
  removed: boolean;
  months: DisclosureMonthCell[];
  /** Distinct members across the whole window. NOT the sum of the monthly figures. */
  totalMembers: number;
  totalDisclosures: number;
  lastDisclosedAt: string | null;
}

export interface AdminDisclosuresResponse {
  /** `YYYY-MM` labels covering the window, oldest first, with no gaps. */
  months: string[];
  recipients: DisclosureRecipientRow[];
  /** UTC instant the window starts at. */
  since: string;
  monthsRequested: number;
  /** Rows older than this many years are deleted by the purge job. */
  disclosureRetentionYears: number;
  /** True when nothing has ever been disclosed, which is the normal state. */
  empty: boolean;
}

/** `YYYY-MM` for a UTC instant. */
function monthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

/** The `months` most recent month labels, oldest first, ending with this month. */
function monthLabels(now: Date, months: number): string[] {
  const out: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

export default defineEventHandler(async (event): Promise<AdminDisclosuresResponse> => {
  requireFeature('admin');
  requireFeature('persona');
  requirePermission(event, 'settings.manage');

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsed.error.flatten(),
    });
  }
  const months = parsed.data.months;

  const db = useDB();
  const config = useConfig();

  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  // Two grains, one pass each. The monthly grain cannot produce the window
  // total: distinct members do not sum across months, because one member pulled
  // in March and again in April is one member, not two.
  const [monthly, totals, declared] = await Promise.all([
    db
      .select({
        recipientId: disclosureEvents.recipientId,
        month: sql<string>`to_char(date_trunc('month', ${disclosureEvents.disclosedAt} at time zone 'UTC'), 'YYYY-MM')`,
        members: sql<number>`count(distinct ${disclosureEvents.userId})::int`,
        disclosures: sql<number>`count(*)::int`,
      })
      .from(disclosureEvents)
      .where(gte(disclosureEvents.disclosedAt, since))
      .groupBy(
        disclosureEvents.recipientId,
        sql`date_trunc('month', ${disclosureEvents.disclosedAt} at time zone 'UTC')`,
      ),
    db
      .select({
        recipientId: disclosureEvents.recipientId,
        members: sql<number>`count(distinct ${disclosureEvents.userId})::int`,
        disclosures: sql<number>`count(*)::int`,
        lastDisclosedAt: sql<string>`max(${disclosureEvents.disclosedAt})`,
      })
      .from(disclosureEvents)
      .where(gte(disclosureEvents.disclosedAt, since))
      .groupBy(disclosureEvents.recipientId),
    effectiveRecipients(db, config),
  ]);

  const names = new Map(declared.map((r) => [r.id, r.name]));
  const labels = monthLabels(now, months);

  const byRecipient = new Map<string, Map<string, DisclosureMonthCell>>();
  for (const row of monthly) {
    let cells = byRecipient.get(row.recipientId);
    if (cells === undefined) {
      cells = new Map<string, DisclosureMonthCell>();
      byRecipient.set(row.recipientId, cells);
    }
    cells.set(row.month, {
      month: row.month,
      members: Number(row.members),
      disclosures: Number(row.disclosures),
    });
  }

  const recipients: DisclosureRecipientRow[] = totals
    .map((total) => {
      const cells = byRecipient.get(total.recipientId) ?? new Map<string, DisclosureMonthCell>();
      const last = total.lastDisclosedAt === null ? null : new Date(total.lastDisclosedAt);
      return {
        recipientId: total.recipientId,
        name: names.get(total.recipientId) ?? null,
        removed: !names.has(total.recipientId),
        // Every label, gap-filled with zeroes, so a month with no activity is a
        // zero the operator can see rather than a column that silently shifts.
        months: labels.map(
          (month) => cells.get(month) ?? { month, members: 0, disclosures: 0 },
        ),
        totalMembers: Number(total.members),
        totalDisclosures: Number(total.disclosures),
        lastDisclosedAt: last === null || Number.isNaN(last.getTime()) ? null : last.toISOString(),
      };
    })
    // Busiest first: the row worth looking at is the one pulling the most people.
    .sort((a, b) => b.totalMembers - a.totalMembers || a.recipientId.localeCompare(b.recipientId));

  const sharing = dataSharingConfigSchema.safeParse(
    (config as { dataSharing?: unknown }).dataSharing ?? {},
  );
  const retentionYears = sharing.success
    ? sharing.data.disclosureRetentionYears
    : dataSharingConfigSchema.parse({}).disclosureRetentionYears;

  return {
    months: labels,
    recipients,
    since: since.toISOString(),
    monthsRequested: months,
    disclosureRetentionYears: retentionYears,
    empty: recipients.length === 0,
  };
});
