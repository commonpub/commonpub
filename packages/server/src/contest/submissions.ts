import { eq, and, sql } from 'drizzle-orm';
import {
  contests,
  contestEntries,
  contestAgreementAcceptances,
  contestEntryPrivateFields,
} from '@commonpub/schema';
import type { ContentType, ContestStageSubmission } from '@commonpub/schema';
import type { DB } from '../types.js';
import { countRows } from '../query.js';
import { createContent, deleteContent } from '../content/content.js';
import { normalizeStages, currentStage, isEliminated } from './stages.js';
import { validateSubmissionFields, hashTerms } from './validation.js';
import type { StageSource, AgreementAcceptanceInput, ContestTx } from './types.js';

// DB-backed submission writers. Pure validation/partition lives in validation.ts.

/**
 * Persist the PII + agreement halves of a partitioned submission within an open
 * transaction. PII is upserted (one row per entry, merged with any prior PII so
 * a later stage's PII doesn't wipe an earlier stage's); agreements are appended
 * as immutable acceptance rows (terms hash + snapshot). No-op when both empty.
 */
export async function recordPrivateAndAgreements(
  tx: ContestTx,
  args: {
    contestId: string;
    entryId: string;
    userId: string;
    stageId: string;
    pii: Record<string, string>;
    agreements: AgreementAcceptanceInput[];
    ip?: string | null;
  },
): Promise<void> {
  const { contestId, entryId, userId, stageId, pii, agreements, ip } = args;

  if (Object.keys(pii).length > 0) {
    const [existing] = await tx
      .select({ fields: contestEntryPrivateFields.fields })
      .from(contestEntryPrivateFields)
      .where(eq(contestEntryPrivateFields.entryId, entryId))
      .for('update');
    const merged = { ...(existing?.fields ?? {}), ...pii };
    await tx
      .insert(contestEntryPrivateFields)
      .values({ contestId, entryId, userId, fields: merged })
      .onConflictDoUpdate({
        target: contestEntryPrivateFields.entryId,
        set: { fields: merged, updatedAt: new Date() },
      });
  }

  if (agreements.length > 0) {
    await tx.insert(contestAgreementAcceptances).values(
      agreements.map((a) => ({
        contestId,
        entryId,
        userId,
        stageId,
        fieldKey: a.fieldKey,
        termsHash: hashTerms(a.terms),
        termsSnapshot: a.terms,
        ip: ip ?? null,
      })),
    );
  }
}

/**
 * Submit (or update) an entrant's per-stage artifact: the filled template
 * values for one `submission` stage, snapshotted onto the entry's
 * `stageSubmissions`. Owner-only. The stage must be the contest's CURRENT
 * stage while the contest is `active` (status stays the gating truth — the
 * organizer maps a later submission round back to `active` when advancing).
 * Re-submitting while the stage is open replaces that stage's artifact.
 * Cohort gate: an entry culled at a prior review stage can no longer submit.
 */
export async function submitStageArtifact(
  db: DB,
  entryId: string,
  stageId: string,
  fields: Record<string, string>,
  userId: string,
  ip?: string | null,
): Promise<{ submitted: boolean; stageSubmissions?: ContestStageSubmission[]; error?: string }> {
  const fail = (error: string) => ({ submitted: false, error });

  const existing = await db
    .select({
      contestId: contestEntries.contestId,
      entrantId: contestEntries.userId,
      stageState: contestEntries.stageState,
      contestStatus: contests.status,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
    })
    .from(contestEntries)
    .innerJoin(contests, eq(contestEntries.contestId, contests.id))
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (existing.length === 0) return fail('Entry not found');
  const row = existing[0]!;
  if (row.entrantId !== userId) return fail('Not the entry owner');

  if (row.contestStatus !== 'active') {
    return fail('Stage submissions are only open while the contest is active');
  }

  const source: StageSource = {
    status: row.contestStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    judgingEndDate: row.judgingEndDate,
    stages: row.stages,
    currentStageId: row.currentStageId,
  };
  const stages = normalizeStages(source);
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return fail('Unknown stage');
  if (stage.kind !== 'submission') return fail('This stage does not accept submissions');
  const template = stage.submissionTemplate ?? [];
  if (template.length === 0) return fail('This stage has no submission template');

  const current = currentStage(source);
  if (current?.id !== stageId) return fail('This stage is not currently open');

  // Cohort gate: once a review cut culled the field, eliminated entries are
  // out of every later round (mirrors judgeContestEntry's gate).
  if (isEliminated({ stageState: row.stageState })) {
    return fail('This entry was not advanced and can no longer submit');
  }

  const validated = validateSubmissionFields(template, fields);
  if (!validated.ok) return fail(validated.error);
  const { artifact, pii, agreements } = validated.result;

  // Atomic read-modify-write: lock the entry row so two concurrent saves of
  // the same artifact can't clobber each other (same pattern as judgeScores).
  // PII + agreements (if the template has any) are persisted in the SAME tx so
  // they can never land in the public stageSubmissions jsonb.
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ stageSubmissions: contestEntries.stageSubmissions })
      .from(contestEntries)
      .where(eq(contestEntries.id, entryId))
      .for('update');

    const submissions = (locked?.stageSubmissions ?? []) as ContestStageSubmission[];
    const record: ContestStageSubmission = { stageId, fields: artifact, submittedAt: new Date().toISOString() };
    const idx = submissions.findIndex((s) => s.stageId === stageId);
    if (idx >= 0) submissions[idx] = record;
    else submissions.push(record);

    await tx
      .update(contestEntries)
      .set({ stageSubmissions: submissions })
      .where(eq(contestEntries.id, entryId));

    await recordPrivateAndAgreements(tx, { contestId: row.contestId, entryId, userId, stageId, pii, agreements, ip });

    return { submitted: true, stageSubmissions: submissions };
  });
}

// --- Form-first proposal submissions (Phase 4) ---

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
  // `contentType` is the ACTUAL created type (after PLACEHOLDER_TYPES fallback +
  // createContent's article→blog normalization) so the client routes to the
  // right editor URL instead of guessing from eligibleContentTypes.
  | { ok: true; entryId: string; projectSlug: string; contentId: string; contentType: string }
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
        .set({ entryCount: sql`${contests.entryCount} + 1` })
        .where(eq(contests.id, contestId));

      await recordPrivateAndAgreements(tx, { contestId, entryId: inserted.id, userId, stageId, pii, agreements, ip });
      return inserted.id;
    });

    return { ok: true, entryId, projectSlug: placeholder.slug, contentId: placeholder.id, contentType: placeholder.type };
  } catch (err) {
    await deleteContent(db, placeholder.id, userId).catch(() => {});
    if (err instanceof Error && err.message === 'entry-conflict') {
      return fail('You already have an entry for this contest');
    }
    throw err;
  }
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
    /** Consent-audit IP captured at acceptance. Surfaced so the subject can see
     *  the data held about them (transparency) and organizers have the audit trail. */
    ip: string | null;
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
      ip: contestAgreementAcceptances.ip,
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
