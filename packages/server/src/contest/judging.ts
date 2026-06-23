import { eq, and } from 'drizzle-orm';
import { contests, contestEntries, contestJudges } from '@commonpub/schema';
import type { DB } from '../types.js';
import { isContestEditor } from './stakeholders.js';
import { currentStage, normalizeStages, isEliminated } from './stages.js';
import type { CriterionScore, JudgeScoreEntry, AdvanceStageInput } from './types.js';

export async function judgeContestEntry(
  db: DB,
  entryId: string,
  score: number | undefined,
  judgeId: string,
  feedback?: string,
  criteriaScores?: CriterionScore[],
): Promise<{ judged: boolean; error?: string }> {
  // Get the entry and its contest (read-only validation, no lock needed).
  const existing = await db
    .select({
      contestStatus: contests.status,
      contestId: contests.id,
      entrantId: contestEntries.userId,
      stageState: contestEntries.stageState,
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

  if (existing.length === 0) return { judged: false, error: 'Entry not found' };

  const row = existing[0]!;

  // Check contest is in judging phase
  if (row.contestStatus !== 'judging') {
    return { judged: false, error: 'Contest is not in judging phase' };
  }

  // Cohort gate (Phase B2.5): once a review stage has culled the field, entries
  // that didn't advance are out of later rounds and can't be scored.
  if (isEliminated({ stageState: row.stageState })) {
    return { judged: false, error: 'This entry was not advanced and can no longer be scored' };
  }

  // Per-round isolation: which review round is this score for? The entry's live
  // `score` will aggregate only THIS round's judge scores (a classic contest with
  // no explicit stages resolves to the synthesized `core-review`, so it stays one
  // bucket — unchanged single-round behaviour).
  const roundStage = currentStage({
    status: row.contestStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    judgingEndDate: row.judgingEndDate,
    stages: row.stages,
    currentStageId: row.currentStageId,
  });
  const roundId = roundStage && roundStage.kind === 'review' ? roundStage.id : null;

  // Conflict of interest: a judge cannot score their own entry.
  if (row.entrantId === judgeId) {
    return { judged: false, error: 'You cannot judge your own entry' };
  }

  // Check judge authorization via contestJudges table (accepted judges only)
  const [judgeRecord] = await db
    .select({ id: contestJudges.id, role: contestJudges.role, acceptedAt: contestJudges.acceptedAt })
    .from(contestJudges)
    .where(and(eq(contestJudges.contestId, row.contestId), eq(contestJudges.userId, judgeId)))
    .limit(1);

  if (!judgeRecord) {
    return { judged: false, error: 'Not authorized to judge this contest' };
  }
  if (!judgeRecord.acceptedAt) {
    return { judged: false, error: 'Judge invitation has not been accepted' };
  }
  if (judgeRecord.role === 'guest') {
    return { judged: false, error: 'Guest judges cannot submit scores' };
  }

  // Derive the overall 0–100 score. When per-criterion scores are supplied, the
  // overall is the normalized weighted sum (sum(score)/sum(max)*100), which
  // supports any weight scheme; otherwise use the supplied overall score.
  let overall: number;
  if (criteriaScores && criteriaScores.length > 0) {
    const totalMax = criteriaScores.reduce((s, c) => s + c.max, 0);
    if (totalMax <= 0) return { judged: false, error: 'Invalid judging criteria' };
    if (criteriaScores.some((c) => c.score < 0 || c.score > c.max)) {
      return { judged: false, error: 'A criterion score is out of range' };
    }
    overall = Math.round((criteriaScores.reduce((s, c) => s + c.score, 0) / totalMax) * 100);
  } else if (typeof score === 'number') {
    overall = score;
  } else {
    return { judged: false, error: 'No score provided' };
  }

  // Atomic read-modify-write: lock the entry row so two judges scoring the same
  // entry concurrently can't clobber each other's judgeScores (lost update).
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ judgeScores: contestEntries.judgeScores })
      .from(contestEntries)
      .where(eq(contestEntries.id, entryId))
      .for('update');

    const scores = (locked?.judgeScores ?? []) as JudgeScoreEntry[];
    const record: JudgeScoreEntry = { judgeId, score: overall, feedback };
    if (criteriaScores && criteriaScores.length > 0) record.criteriaScores = criteriaScores;
    if (roundId) record.roundId = roundId;

    // A judge has one score per round — match on judge AND round.
    const existingIdx = scores.findIndex((s) => s.judgeId === judgeId && (s.roundId ?? null) === (roundId ?? null));
    if (existingIdx >= 0) scores[existingIdx] = record;
    else scores.push(record);

    // The live aggregate reflects ONLY the current round's scores, so a later
    // judging round doesn't blend with an earlier one. Earlier rounds stay in
    // `judgeScores` (tagged with their roundId) as history.
    const roundScores = roundId ? scores.filter((s) => (s.roundId ?? null) === roundId) : scores;
    const avgScore = roundScores.length
      ? Math.round(roundScores.reduce((sum, s) => sum + s.score, 0) / roundScores.length)
      : 0;

    await tx
      .update(contestEntries)
      .set({ judgeScores: scores, score: avgScore })
      .where(eq(contestEntries.id, entryId));

    return { judged: true };
  });
}

/**
 * Phase B2 — apply an advancement cut at a review stage: the surviving cohort
 * (entries not already eliminated) is split into advancers + eliminated, the
 * round's score/rank is snapshotted into each entry's `stageState`, and the
 * contest's `currentStageId` moves to the next stage. Idempotent per stage —
 * re-running replaces that stage's `stageState` rows rather than duplicating them.
 * Owner-gated. `topN` ties broken by score → rank → id for determinism.
 */
export async function advanceContestStage(
  db: DB,
  contestId: string,
  userId: string,
  input: AdvanceStageInput,
  canManage = false,
): Promise<{ advanced: boolean; advancedCount: number; eliminatedCount: number; error?: string }> {
  const fail = (error: string) => ({ advanced: false, advancedCount: 0, eliminatedCount: 0, error });

  const [contest] = await db
    .select({
      createdById: contests.createdById,
      status: contests.status,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest) return fail('Contest not found');
  if (contest.createdById !== userId && !canManage && !(await isContestEditor(db, contestId, userId))) {
    return fail('Not authorized to manage this contest');
  }

  const stages = normalizeStages(contest);
  const idx = stages.findIndex((s) => s.id === input.reviewStageId);
  if (idx < 0) return fail('Unknown stage');
  if (stages[idx]!.kind !== 'review') return fail('Advancement applies to review stages only');

  const rows = await db
    .select({ id: contestEntries.id, userId: contestEntries.userId, score: contestEntries.score, rank: contestEntries.rank, stageState: contestEntries.stageState })
    .from(contestEntries)
    .where(eq(contestEntries.contestId, contestId));

  // Only the running cohort (not already eliminated) is subject to the cut.
  const eligible = rows.filter((r) => !isEliminated(r));

  let advancedIds: Set<string>;
  if (input.mode === 'manual') {
    const picked = new Set(input.advancedEntryIds ?? []);
    advancedIds = new Set(eligible.filter((e) => picked.has(e.id)).map((e) => e.id));
  } else {
    const n = Math.max(0, input.topN ?? 0);
    const sorted = [...eligible].sort(
      (a, b) =>
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
        a.id.localeCompare(b.id),
    );
    advancedIds = new Set(sorted.slice(0, n).map((e) => e.id));
  }

  const nextStage = stages[idx + 1];

  // Per-entry stage advance + the currentStageId bump must be atomic so a
  // partial failure can't leave the cohort half-advanced against the new stage.
  let advancedCount = 0;
  let eliminatedCount = 0;
  await db.transaction(async (tx) => {
    advancedCount = 0;
    eliminatedCount = 0;
    for (const e of eligible) {
      const isAdv = advancedIds.has(e.id);
      const prior = (e.stageState ?? []).filter((s) => s.stageId !== input.reviewStageId);
      const next = [...prior, { stageId: input.reviewStageId, status: isAdv ? ('advanced' as const) : ('eliminated' as const), score: e.score ?? null, rank: e.rank ?? null }];
      await tx.update(contestEntries).set({ stageState: next }).where(eq(contestEntries.id, e.id));
      if (isAdv) advancedCount++;
      else eliminatedCount++;
    }

    if (nextStage) {
      await tx.update(contests).set({ currentStageId: nextStage.id, updatedAt: new Date() }).where(eq(contests.id, contestId));
    }
  });

  // Notify entrants of the outcome (non-critical, de-duped by user).
  try {
    const { createNotification } = await import('../notification/notification.js');
    const [info] = await db.select({ title: contests.title, slug: contests.slug }).from(contests).where(eq(contests.id, contestId)).limit(1);
    if (info) {
      const nextName = nextStage?.name ?? 'the next stage';
      const seen = new Set<string>();
      for (const e of eligible) {
        if (seen.has(e.userId)) continue;
        seen.add(e.userId);
        const adv = advancedIds.has(e.id);
        createNotification(db, {
          userId: e.userId,
          type: 'contest',
          title: adv ? 'You advanced!' : 'Contest update',
          message: adv
            ? `Your entry advanced to ${nextName} in "${info.title}".`
            : `Your entry wasn't selected to continue in "${info.title}".`,
          link: `/contests/${info.slug}`,
          actorId: userId,
        }).catch(() => {});
      }
    }
  } catch {
    /* non-critical */
  }

  return { advanced: true, advancedCount, eliminatedCount };
}
