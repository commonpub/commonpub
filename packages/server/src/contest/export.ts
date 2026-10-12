import { eq, desc, sql, inArray, and } from 'drizzle-orm';
import { contests, contestEntries, users, contentItems, contestEntryPrivateFields, contestRegistrations, contestRegistrationPrivateFields, contestAgreementAcceptances, isFormFieldPii, effectiveRegistrationTemplate } from '@commonpub/schema';
import type { DB } from '../types.js';
import type { ContestStageSubmission, FormField } from '@commonpub/schema';
import { currentStage, isEliminated } from './stages.js';
import { ADDRESS_PARTS, parseAddressValue, formatAddressLines } from './address.js';
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

/** Export options shared by both CSV builders. */
export interface ExportOptions {
  /**
   * Site origin (e.g. `https://deveco.io`). Links in the sheet (entry pages,
   * private files) are made absolute with it; a spreadsheet has no host to resolve
   * `/api/files/…` against, so a relative link is a dead link there.
   */
  baseUrl?: string;
}

const absolute = (baseUrl: string | undefined, path: string): string =>
  baseUrl ? `${baseUrl.replace(/\/+$/, '')}${path}` : path;

/**
 * One answer becomes one or more sheet columns. An `address` becomes a column per
 * part plus a ready-to-paste mailing label, so a shipping list can be sorted by
 * country and pasted onto a label; everything else stays one column.
 */
function answerColumns(
  label: string,
  type: string,
  read: () => string,
  baseUrl: string | undefined,
): Array<{ header: string; value: () => string }> {
  if (type === 'address') {
    return [
      ...ADDRESS_PARTS.map((part) => ({ header: `${label}: ${part.label}`, value: () => parseAddressValue(read())[part.key] ?? '' })),
      { header: `${label} (mailing label)`, value: () => formatAddressLines(read()).join('\n') },
    ];
  }
  if (type === 'file') {
    // A `file` answer is a bare files.id uuid, useless in a spreadsheet. Emit the
    // gated /raw link (access still enforced by the route's auth + contest.pii).
    return [{ header: label, value: () => { const v = read(); return v ? absolute(baseUrl, `/api/files/${v}/raw`) : ''; } }];
  }
  return [{ header: label, value: read }];
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
  opts: ExportOptions = {},
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

  // PII keys come from stage forms; an `address` key is split into parts (by its
  // form label), every other key keeps its historical `PII: <key>` column.
  const fieldByKey = new Map<string, { label: string; type: string }>();
  for (const st of (contest.stages ?? [])) {
    for (const f of st.submissionTemplate ?? []) fieldByKey.set(f.key, { label: f.label, type: f.type });
  }
  // Two stages may each ask for "Shipping address" under different keys; keep their
  // column groups apart in the sheet by naming the key when a label repeats.
  const addressKeys = piiKeys.filter((k) => fieldByKey.get(k)?.type === 'address');
  const labelUses = new Map<string, number>();
  for (const k of addressKeys) { const l = fieldByKey.get(k)!.label; labelUses.set(l, (labelUses.get(l) ?? 0) + 1); }
  let current: Record<string, string> = {};
  const piiCols = piiKeys.flatMap((k) => {
    const f = fieldByKey.get(k);
    if (f?.type !== 'address') return [{ header: `PII: ${k}`, value: () => current[k] ?? '' }];
    const label = (labelUses.get(f.label) ?? 0) > 1 ? `${f.label} (${k})` : f.label;
    return answerColumns(label, 'address', () => current[k] ?? '', opts.baseUrl);
  });

  const header = [
    'Entry', 'Author', 'Username', 'Status', 'Score', 'Rank', 'Entry URL', 'Project URL', 'Submission',
    ...piiCols.map((c) => c.header),
    ...rubricLabels,
  ];

  const body = rows.map((r) => {
    current = piiByEntry.get(r.id) ?? {};
    return [
      r.title ?? 'Untitled',
      r.authorName ?? r.authorUsername ?? 'Unknown',
      r.authorUsername ?? '',
      entryStatus(r.stageState),
      r.score == null ? '' : String(r.score),
      r.rank == null ? '' : String(r.rank),
      absolute(opts.baseUrl, `/contests/${contest.slug}/entries/${r.id}`),
      r.authorUsername ? absolute(opts.baseUrl, `/u/${r.authorUsername}/${r.contentType}/${r.contentSlug}`) : '',
      summarizeArtifact(r.stageSubmissions),
      ...piiCols.map((c) => c.value()),
      ...rubricLabels.map(() => ''), // empty: filled in by hand during tallying
    ];
  });

  return { filename: `${contest.slug}-entries.csv`, csv: toCsv([header, ...body]) };
}

/**
 * Build the CSV export of a contest's `full` REGISTRANTS (P5). One row per
 * registrant; one column per registration-template ANSWER field, labelled by the
 * operator's field label. PII fields (email/address/pii) are included ONLY when
 * `includePii` (caller gates on `contest.pii`) — their columns are omitted entirely
 * otherwise, so a non-PII export never even hints at the private data. Consent
 * (agreement) + display (section) fields are not answer columns and are skipped.
 * Formula-injection-neutralized via toCsv.
 */
export async function buildRegistrantsExport(
  db: DB,
  contestId: string,
  includePii: boolean,
  opts: ExportOptions & {
    /**
     * `shipping`: only who and how to reach them. Identity plus every contact-type
     * field (short text, email, phone, address) in form order, public or private,
     * since an official name is often an ordinary public text field. Private ones
     * still need `includePii`.
     */
    format?: 'full' | 'shipping';
  } = {},
): Promise<ContestExport | null> {
  const [contest] = await db
    .select({ slug: contests.slug, registrationTemplate: contests.registrationTemplate })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);
  if (!contest) return null;

  // Effective template (operator's, else the legacy default) so a legacy contest's
  // {building,experience,team} answers still get labelled columns — matches the panel.
  const template = effectiveRegistrationTemplate((contest.registrationTemplate ?? []) as FormField[]);
  const isPii = isFormFieldPii; // shared source of truth — see @commonpub/schema
  // Answer columns: skip section (display) + agreement (consent, not a stored value),
  // and skip PII columns unless the reader is allowed them.
  const shipping = opts.format === 'shipping';
  const CONTACT_TYPES = new Set(['text', 'email', 'tel', 'address']);
  const cols = template.filter((f) =>
    f.type !== 'section' && f.type !== 'agreement' && (includePii || !isPii(f)) && (!shipping || CONTACT_TYPES.has(f.type)),
  );

  const rows = await db
    .select({
      registrationId: contestRegistrations.id,
      username: users.username,
      displayName: users.displayName,
      registeredAt: contestRegistrations.createdAt,
      fields: contestRegistrations.fields,
    })
    .from(contestRegistrations)
    .innerJoin(users, eq(contestRegistrations.userId, users.id))
    .where(and(eq(contestRegistrations.contestId, contestId), eq(contestRegistrations.tier, 'full')))
    .orderBy(desc(contestRegistrations.createdAt), desc(contestRegistrations.id))
    .limit(10000);

  // Consent audit column (not PII): count of the CURRENT template's agreement fields
  // this registrant accepted. Filtering by the live agreement keys keeps the count
  // from exceeding the denominator when an operator later removes/renames an agreement
  // (stale acceptance rows for dropped keys must not show as "3/2" or false-complete).
  // Only REQUIRED agreements (mustAccept !== false) count toward consent — declining
  // an optional agreement (e.g. marketing) must not flag a compliant registrant as partial.
  const agreementKeys = template.filter((f) => f.type === 'agreement' && f.mustAccept !== false).map((f) => f.key);
  const agreementCount = agreementKeys.length;
  let consentByReg = new Map<string, number>();
  if (agreementCount > 0 && rows.length > 0) {
    const acc = await db
      .select({
        registrationId: contestAgreementAcceptances.registrationId,
        n: sql<number>`count(distinct ${contestAgreementAcceptances.fieldKey})::int`,
      })
      .from(contestAgreementAcceptances)
      .where(and(
        inArray(contestAgreementAcceptances.registrationId, rows.map((r) => r.registrationId)),
        inArray(contestAgreementAcceptances.fieldKey, agreementKeys),
      ))
      .groupBy(contestAgreementAcceptances.registrationId);
    consentByReg = new Map(acc.map((a) => [a.registrationId as string, a.n]));
  }

  // PII answers (only when allowed), keyed by userId → keep the join off the hot path.
  let privateByUser = new Map<string, Record<string, string>>();
  if (includePii && cols.some(isPii) && rows.length > 0) {
    const priv = await db
      .select({ username: users.username, fields: contestRegistrationPrivateFields.fields })
      .from(contestRegistrationPrivateFields)
      .innerJoin(users, eq(contestRegistrationPrivateFields.userId, users.id))
      .where(eq(contestRegistrationPrivateFields.contestId, contestId));
    privateByUser = new Map(priv.map((p) => [p.username, p.fields]));
  }

  let pub: Record<string, string> = {};
  let priv: Record<string, string> = {};
  const answerCols = cols.flatMap((f) =>
    answerColumns(f.label, f.type, () => ((isPii(f) ? priv[f.key] : pub[f.key]) ?? ''), opts.baseUrl),
  );
  const withConsents = agreementCount > 0 && !shipping;
  const header = [
    'Username', 'Name',
    ...(shipping ? [] : ['Registered']),
    ...(withConsents ? ['Consents'] : []),
    ...answerCols.map((c) => c.header),
  ];
  const body = rows.map((r) => {
    pub = (r.fields ?? {}) as Record<string, string>;
    priv = privateByUser.get(r.username) ?? {};
    return [
      r.username,
      r.displayName ?? '',
      ...(shipping ? [] : [r.registeredAt.toISOString()]),
      ...(withConsents ? [`${consentByReg.get(r.registrationId) ?? 0}/${agreementCount}`] : []),
      ...answerCols.map((c) => c.value()),
    ];
  });

  const suffix = shipping ? 'shipping' : 'registrants';
  return { filename: `${contest.slug}-${suffix}.csv`, csv: toCsv([header, ...body]) };
}
