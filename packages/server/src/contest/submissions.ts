import { eq, and, sql } from 'drizzle-orm';
import {
  contests,
  contestEntries,
  contestAgreementAcceptances,
  contestEntryPrivateFields,
} from '@commonpub/schema';
import type { ContentType } from '@commonpub/schema';
import type { DB } from '../types.js';
import { countRows } from '../query.js';
import { createContent, deleteContent } from '../content/content.js';
import {
  normalizeStages,
  currentStage,
  validateSubmissionFields,
  recordPrivateAndAgreements,
  type StageSource,
} from './contest.js';

/** Content types a placeholder proposal project may be created as. */
const PLACEHOLDER_TYPES: readonly ContentType[] = ['project', 'blog', 'explainer'];

export interface SubmitProposalArgs {
  contestId: string;
  stageId: string;
  /** Raw entrant form values (template-key → string). */
  fields: Record<string, string>;
  userId: string;
  /** Best-effort client IP, recorded with any agreement acceptances. */
  ip?: string | null;
}

export type SubmitProposalResult =
  | { ok: true; entryId: string; projectSlug: string; contentId: string }
  | { ok: false; error: string };

/**
 * Form-first proposal submission (Phase 4). For a `submission` stage in
 * `proposal` mode: validate the form, create a DRAFT placeholder project, link a
 * contest entry to it (relaxing the published-only gate that `submitContestEntry`
 * enforces), snapshot the artifact, record agreement acceptances, store PII in
 * the private table, and bump `entryCount`. The placeholder + the entry +
 * PII/agreements are written atomically: the placeholder is created first, then
 * the entry tx; if the entry tx fails the placeholder is removed (compensating
 * delete) so a failed submit never leaves an orphan draft.
 *
 * Flag (`features.contestProposals`) is enforced at the route; this fn enforces
 * the structural gate that the target stage is current + proposal-mode.
 */
export async function submitContestProposal(db: DB, args: SubmitProposalArgs): Promise<SubmitProposalResult> {
  const { contestId, stageId, fields, userId, ip } = args;
  const fail = (error: string): SubmitProposalResult => ({ ok: false, error });

  const [contest] = await db
    .select({
      id: contests.id,
      title: contests.title,
      status: contests.status,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
      maxEntriesPerUser: contests.maxEntriesPerUser,
      eligibleContentTypes: contests.eligibleContentTypes,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest) return fail('Contest not found');
  if (contest.status !== 'active') return fail('Proposals are only open while the contest is active');

  const source: StageSource = {
    status: contest.status,
    startDate: contest.startDate,
    endDate: contest.endDate,
    judgingEndDate: contest.judgingEndDate,
    stages: contest.stages,
    currentStageId: contest.currentStageId,
  };
  const stage = normalizeStages(source).find((s) => s.id === stageId);
  if (!stage) return fail('Unknown stage');
  if (stage.kind !== 'submission') return fail('This stage does not accept submissions');
  if (stage.submissionMode !== 'proposal') return fail('This stage is not accepting proposals');
  if (currentStage(source)?.id !== stageId) return fail('This stage is not currently open');

  const template = stage.submissionTemplate ?? [];
  const validated = validateSubmissionFields(template, fields);
  if (!validated.ok) return fail(validated.error);
  const { artifact, pii, agreements } = validated.result;

  // Per-user entry cap (mirrors submitContestEntry).
  if (contest.maxEntriesPerUser != null) {
    const existing = await countRows(
      db,
      contestEntries,
      and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)),
    );
    if (existing >= contest.maxEntriesPerUser) return fail('You have reached the entry limit for this contest');
  }

  // Pick the placeholder content type: the contest's first eligible type when
  // it's one we can create, else a project.
  const eligible = (contest.eligibleContentTypes ?? []).find((t) => PLACEHOLDER_TYPES.includes(t as ContentType));
  const placeholderType = (eligible ?? 'project') as ContentType;
  const title = artifact.title?.trim() || `${contest.title} proposal`;

  // 1) Create the DRAFT placeholder (its own writes). The entrant develops it in
  //    the editor; the proposal text lives in the stage artifact below.
  const placeholder = await createContent(db, userId, { type: placeholderType, title });

  // 2) Link the entry + persist artifact/PII/agreements/count atomically. On any
  //    failure, remove the placeholder so a failed submit leaves nothing behind.
  try {
    const entryId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(contestEntries)
        .values({
          contestId,
          contentId: placeholder.id,
          userId,
          stageSubmissions: [{ stageId, fields: artifact, submittedAt: new Date().toISOString() }],
        })
        .onConflictDoNothing()
        .returning({ id: contestEntries.id });

      if (!inserted) throw new Error('entry-conflict');

      await tx
        .update(contests)
        .set({ entryCount: sqlInc() })
        .where(eq(contests.id, contestId));

      await recordPrivateAndAgreements(tx, { contestId, entryId: inserted.id, userId, stageId, pii, agreements, ip });
      return inserted.id;
    });

    return { ok: true, entryId, projectSlug: placeholder.slug, contentId: placeholder.id };
  } catch (err) {
    await deleteContent(db, placeholder.id, userId).catch(() => {});
    if (err instanceof Error && err.message === 'entry-conflict') {
      return fail('You already have an entry for this contest');
    }
    throw err;
  }
}

// `entryCount + 1` as a SQL expression (kept local so the import surface of this
// file stays small; mirrors submitContestEntry's increment).
function sqlInc() {
  return sql`${contests.entryCount} + 1`;
}

export interface EntryPrivateData {
  contestId: string;
  entryId: string;
  userId: string;
  fields: Record<string, string>;
  updatedAt: Date;
  agreements: Array<{
    fieldKey: string;
    stageId: string;
    termsHash: string;
    termsSnapshot: string;
    acceptedAt: Date;
  }>;
}

/**
 * Read an entry's PII + agreement acceptances. NEVER reachable through the
 * normal entries endpoints — the calling route gates this on the `contest.pii`
 * permission OR the requester being the entrant. Returns null when the entry has
 * no stored PII and no agreements.
 */
export async function getEntryPrivateData(db: DB, entryId: string): Promise<EntryPrivateData | null> {
  const [priv] = await db
    .select()
    .from(contestEntryPrivateFields)
    .where(eq(contestEntryPrivateFields.entryId, entryId))
    .limit(1);

  const agreements = await db
    .select({
      fieldKey: contestAgreementAcceptances.fieldKey,
      stageId: contestAgreementAcceptances.stageId,
      termsHash: contestAgreementAcceptances.termsHash,
      termsSnapshot: contestAgreementAcceptances.termsSnapshot,
      acceptedAt: contestAgreementAcceptances.acceptedAt,
    })
    .from(contestAgreementAcceptances)
    .where(eq(contestAgreementAcceptances.entryId, entryId));

  if (!priv && agreements.length === 0) return null;

  return {
    contestId: priv?.contestId ?? '',
    entryId,
    userId: priv?.userId ?? '',
    fields: (priv?.fields ?? {}) as Record<string, string>,
    updatedAt: priv?.updatedAt ?? new Date(0),
    agreements,
  };
}
