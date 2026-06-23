import { eq, desc, sql, inArray } from 'drizzle-orm';
import { contests, contestEntries, users, contentItems, contestEntryPrivateFields } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { ContestStageSubmission } from '@commonpub/schema';
import { currentStage, isEliminated } from './stages.js';
import type { ContestJudgingCriterion } from './types.js';

// Contest submissions export (Phase 5 / G9). Pages through ALL entries (not the
// 100 cap of the listing) and emits a spreadsheet for offline judging/tallying:
// one row per entry, one EMPTY column per rubric criterion for manual scoring,
// and PII columns ONLY when the requester holds `contest.pii`.

/**
 * RFC 4180 CSV with formula-injection neutralization. Cells are entrant-controlled
 * (titles, proposal text, author names), so a value starting with `= + - @` or a
 * control char (TAB/CR) is prefixed with a `'` before quoting — otherwise Excel /
 * Sheets would evaluate it as a formula when an organizer opens the export. Then
 * standard quoting: wrap fields containing `"`, `,`, CR or LF; double embedded quotes.
 */
export function toCsv(rows: string[][]): string {
  const cell = (v: string): string => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Derive an entry's cohort status from its stageState. */
function entryStatus(stageState: Array<{ status: string }> | null | undefined): string {
  if (isEliminated({ stageState })) return 'eliminated';
  if (stageState?.some((s) => s.status === 'advanced')) return 'advanced';
  return 'active';
}

/** Summarize an entry's submitted artifact fields (non-PII) as `key: value; …`. */
function summarizeArtifact(stageSubmissions: ContestStageSubmission[] | null | undefined): string {
  if (!stageSubmissions?.length) return '';
  // The most recent stage artifact (entrants iterate proposal → prototype).
  const latest = [...stageSubmissions].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0]!;
  return Object.entries(latest.fields).map(([k, v]) => `${k}: ${v}`).join('; ');
}

export interface ContestExport {
  filename: string;
  csv: string;
}

/**
 * Build the CSV export for a contest. `includePii` (caller gates on `contest.pii`)
 * adds a column per PII field key; the rubric (this round's `criteria` else the
 * contest `judgingCriteria`) contributes one EMPTY column each for manual tallying.
 */
export async function buildContestExport(
  db: DB,
  contestId: string,
  includePii: boolean,
): Promise<ContestExport | null> {
  const [contest] = await db
    .select({
      slug: contests.slug,
      title: contests.title,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      judgingCriteria: contests.judgingCriteria,
      status: contests.status,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);
  if (!contest) return null;

  // Rubric labels for the empty tally columns (current round, else contest-level).
  const round = currentStage({
    status: contest.status,
    startDate: contest.startDate,
    endDate: contest.endDate,
    judgingEndDate: contest.judgingEndDate,
    stages: contest.stages,
    currentStageId: contest.currentStageId,
  });
  const rubric = ((round?.criteria ?? contest.judgingCriteria ?? []) as ContestJudgingCriterion[]);
  const rubricLabels = rubric.map((c) => c.label);

  // ALL entries (no 100 cap), ranked-ish so the export reads top-down.
  const rows = await db
    .select({
      id: contestEntries.id,
      userId: contestEntries.userId,
      score: contestEntries.score,
      rank: contestEntries.rank,
      stageState: contestEntries.stageState,
      stageSubmissions: contestEntries.stageSubmissions,
      title: contentItems.title,
      contentSlug: contentItems.slug,
      contentType: contentItems.type,
      authorName: users.displayName,
      authorUsername: users.username,
    })
    .from(contestEntries)
    .innerJoin(contentItems, eq(contestEntries.contentId, contentItems.id))
    .innerJoin(users, eq(contestEntries.userId, users.id))
    .where(eq(contestEntries.contestId, contestId))
    .orderBy(sql`${contestEntries.score} DESC NULLS LAST`, desc(contestEntries.submittedAt));

  // PII (gated): one row per entry → map entryId → fields, then a column per key.
  const piiByEntry = new Map<string, Record<string, string>>();
  let piiKeys: string[] = [];
  if (includePii && rows.length) {
    const priv = await db
      .select({ entryId: contestEntryPrivateFields.entryId, fields: contestEntryPrivateFields.fields })
      .from(contestEntryPrivateFields)
      .where(inArray(contestEntryPrivateFields.entryId, rows.map((r) => r.id)));
    const keys = new Set<string>();
    for (const p of priv) {
      piiByEntry.set(p.entryId, p.fields as Record<string, string>);
      for (const k of Object.keys(p.fields as Record<string, string>)) keys.add(k);
    }
    piiKeys = [...keys].sort();
  }

  const header = [
    'Entry', 'Author', 'Username', 'Status', 'Score', 'Rank', 'Entry URL', 'Project URL', 'Submission',
    ...piiKeys.map((k) => `PII: ${k}`),
    ...rubricLabels,
  ];

  const body = rows.map((r) => {
    const pii = piiByEntry.get(r.id) ?? {};
    return [
      r.title ?? 'Untitled',
      r.authorName ?? r.authorUsername ?? 'Unknown',
      r.authorUsername ?? '',
      entryStatus(r.stageState),
      r.score == null ? '' : String(r.score),
      r.rank == null ? '' : String(r.rank),
      `/contests/${contest.slug}/entries/${r.id}`,
      r.authorUsername ? `/u/${r.authorUsername}/${r.contentType}/${r.contentSlug}` : '',
      summarizeArtifact(r.stageSubmissions),
      ...piiKeys.map((k) => pii[k] ?? ''),
      ...rubricLabels.map(() => ''), // empty: filled in by hand during tallying
    ];
  });

  return { filename: `${contest.slug}-entries.csv`, csv: toCsv([header, ...body]) };
}
