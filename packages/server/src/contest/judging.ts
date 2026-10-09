import { eq, and } from 'drizzle-orm';
import { contests, contestEntries, contestJudges } from '@commonpub/schema';
import type { DB } from '../types.js';
import { isContestEditor } from './stakeholders.js';
import { currentStage, normalizeStages, isEliminated } from './stages.js';
import type { ContestJudgingCriterion, CriterionScore, JudgeScoreEntry, AdvanceStageInput } from './types.js';

/** A rubric criterion's max points: its `weight` when set (>0), else 100. */
export function rubricCriterionMax(c: ContestJudgingCriterion): number {
  return typeof c.weight === 'number' && c.weight > 0 ? c.weight : 100;
}

/**
 * B3 — validate per-criterion scores against the RESOLVED rubric and compute the
 * normalized overall (0–100) using the rubric's maxes, NOT the client-supplied
 * `max` (which a tampering client could inflate to skew the weighted sum). Pure +
 * testable. Rejects unknown criteria, missing criteria, and out-of-range scores.
 * Returns the normalized criteriaScores (with rubric-authoritative `max`) to store.
 */
export function scoreAgainstRubric(
  rubric: ContestJudgingCriterion[] | null | undefined,
  submitted: CriterionScore[],
): { ok: true; overall: number; normalized: CriterionScore[] } | { ok: false; error: string } {
  if (!rubric || rubric.length === 0) {
    return { ok: false, error: 'This contest has no judging rubric for this round; submit a single score' };
  }
  const rubricLabels = new Set(rubric.map((c) => c.label));
  for (const s of submitted) {
    if (!rubricLabels.has(s.label)) return { ok: false, error: `Unknown criterion: ${s.label}` };
  }
  const byLabel = new Map(submitted.map((s) => [s.label, s]));
  const normalized: CriterionScore[] = [];
  let totalScore = 0;
  let totalMax = 0;
  for (const c of rubric) {
    const max = rubricCriterionMax(c);
    const s = byLabel.get(c.label);
    if (!s) return { ok: false, error: `Missing score for ${c.label}` };
    if (s.score < 0 || s.score > max) return { ok: false, error: `${c.label} score must be between 0 and ${max}` };
    normalized.push({ label: c.label, score: s.score, max }); // rubric max is authoritative
    totalScore += s.score;
    totalMax += max;
  }
  if (totalMax <= 0) return { ok: false, error: 'Invalid judging rubric' };
  return { ok: true, overall: Math.round((totalScore / totalMax) * 100), normalized };
}

export async function judgeContestEntry(
  db: DB,
  entryId: string,
  score: number | undefined,
  judgeId: string,
  feedback?: string,
  criteriaScores?: CriterionScore[],
  expectedContestId?: string,
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
      judgingCriteria: contests.judgingCriteria,
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

  // B5a — when the caller resolved the contest from the route `:slug`, the entry
  // must belong to THAT contest. The route `/contests/:slug/judge` otherwise
  // ignored its slug and judged purely by entryId, a misleading contract (not an
  // escalation, since the judge-authorization gate below is contest-scoped, but
  // the route claims slug-scoping it never enforced).
  if (expectedContestId && row.contestId !== expectedContestId) {
    return { judged: false, error: 'Entry does not belong to this contest' };
  }

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

  // A staged contest only scores inside a review round. After a cut the current
  // stage moves on (e.g. to a build sprint) while the status stays `judging`;
  // scoring there used to save UNTAGGED scores, and the live average then mixed
  // every round together (session 260). A classic contest always resolves to
  // its synthesized review stage while judging, so it never reaches this.
  if (!roundId) {
    return { judged: false, error: 'No review round is open right now. The organizer needs to make a review stage the current stage.' };
  }

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

  // Derive the overall 0–100 score. When per-criterion scores are supplied, they
  // are validated against the RESOLVED rubric (this round's `criteria`, else the
  // contest-level `judgingCriteria`) and the overall is the normalized weighted
  // sum computed with the RUBRIC's maxes (B3 — never trust the client `max`).
  // Otherwise use the supplied holistic score.
  let overall: number;
  let storedCriteria: CriterionScore[] | undefined;
  if (criteriaScores && criteriaScores.length > 0) {
    const rubric = (roundStage?.criteria ?? row.judgingCriteria ?? null) as ContestJudgingCriterion[] | null;
    const scored = scoreAgainstRubric(rubric, criteriaScores);
    if (!scored.ok) return { judged: false, error: scored.error };
    overall = scored.overall;
    storedCriteria = scored.normalized;
  } else if (typeof score === 'number') {
    overall = score;
  } else {
    return { judged: false, error: 'No score provided' };
  }

  // Atomic read-modify-write: lock the entry row so two judges scoring the same
  // entry concurrently can't clobber each other's judgeScores (lost update).
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ judgeScores: contestEntries.judgeScores, stageState: contestEntries.stageState })
      .from(contestEntries)
      .where(eq(contestEntries.id, entryId))
      .for('update');
    // Re-check under the lock: a cut that landed between the read above and
    // this write must not be undone by a late score.
    if (isEliminated({ stageState: locked?.stageState })) {
      return { judged: false, error: 'This entry was not advanced and can no longer be scored' };
    }
    // And the judge is still on the panel. removeContestJudge deletes the judge
    // row BEFORE it locks entries to strip scores, so a score that waited on this
    // lock behind a removal would otherwise be appended after the strip and keep
    // counting (session 260 review).
    const [stillJudge] = await tx
      .select({ role: contestJudges.role, acceptedAt: contestJudges.acceptedAt })
      .from(contestJudges)
      .where(and(eq(contestJudges.contestId, row.contestId), eq(contestJudges.userId, judgeId)))
      .limit(1);
    if (!stillJudge || !stillJudge.acceptedAt || stillJudge.role === 'guest') {
      return { judged: false, error: 'Not authorized to judge this contest' };
    }

    const scores = (locked?.judgeScores ?? []) as JudgeScoreEntry[];
    const record: JudgeScoreEntry = { judgeId, score: overall, feedback };
    if (storedCriteria) record.criteriaScores = storedCriteria;
    if (roundId) record.roundId = roundId;

    // A judge has one score per round — match on judge AND round.
    const existingIdx = scores.findIndex((s) => s.judgeId === judgeId && (s.roundId ?? null) === (roundId ?? null));
    if (existingIdx >= 0) scores[existingIdx] = record;
    else scores.push(record);

    // The live aggregate reflects ONLY the current round's scores, so a later
    // judging round doesn't blend with an earlier one. Earlier rounds stay in
    // `judgeScores` (tagged with their roundId) as history.
    const roundScores = scores.filter((s) => (s.roundId ?? null) === roundId);
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

  // A cut is a judging-time action. Before this check an organizer could press
  // Advance while the contest was still `active` and move the stage pointer past
  // a round nobody had judged yet (session 260).
  if (contest.status !== 'judging') return fail('Entries can only be advanced while the contest is in judging');

  // Which round may be cut: the CURRENT review round, or an earlier one being
  // re-run to correct it. A later round can't be cut before it is reached.
  const cur = currentStage(contest);
  const curIdx = cur ? stages.findIndex((s) => s.id === cur.id) : -1;
  if (idx > curIdx) return fail('Only the current review round can be advanced');
  const isCurrent = idx === curIdx;
  const laterReviewIds = new Set(stages.slice(idx + 1).filter((s) => s.kind === 'review').map((s) => s.id));
  const nextStage = stages[idx + 1];
  const hasLaterReview = laterReviewIds.size > 0;

  if (input.mode === 'manual' && !(input.advancedEntryIds ?? []).length) {
    return fail('Pick at least one entry to advance');
  }

  // Read the cohort, compute the cut, and write it all inside ONE transaction
  // with the entry rows locked FOR UPDATE, so concurrent advances (or a judge
  // scoring mid-advance) serialize instead of clobbering each other.
  type Outcome = { advancedCount: number; eliminatedCount: number; eligible: Array<{ id: string; userId: string }>; advancedIds: Set<string> };
  const outcome: Outcome | { error: string } = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: contestEntries.id, userId: contestEntries.userId, score: contestEntries.score, rank: contestEntries.rank, stageState: contestEntries.stageState, judgeScores: contestEntries.judgeScores })
      .from(contestEntries)
      .where(eq(contestEntries.contestId, contestId))
      .for('update');

    // Re-running an earlier round once a later round has been cut or scored
    // would reshuffle a field that later judges are already working on.
    // Checked whether or not this round is "current": an organizer can move the
    // pointer back to an earlier round by hand, and a cut there would otherwise
    // reshuffle the later field and clear its live scores (session 260 review).
    const laterStarted = rows.some(
      (r) =>
        (r.stageState ?? []).some((s) => laterReviewIds.has(s.stageId)) ||
        ((r.judgeScores ?? []) as JudgeScoreEntry[]).some((s) => s.roundId && laterReviewIds.has(s.roundId)),
    );
    if (laterStarted) return { error: 'A later round has already started, so this cut can no longer be changed' };

    // The cohort is every entry not eliminated at some OTHER stage. Eliminations
    // from THIS stage are exactly what a re-run recomputes; filtering them out
    // (as this did) meant a re-run could only ever shrink the field, so a
    // mistaken Top 5 could never be widened back to Top 50 (session 260).
    const eligible = rows.filter(
      (r) => !(r.stageState ?? []).some((s) => s.status === 'eliminated' && s.stageId !== input.reviewStageId),
    );

    // Cut on THIS round's own scores: the mean of the judge scores tagged with
    // this round. The live `score` is only recomputed when someone scores the
    // entry, so an advanced entry nobody re-scored carried its previous round's
    // average into this cut. Legacy contests whose scores predate round tags
    // fall back to the live score.
    const roundMean = (r: (typeof rows)[number]): number | null => {
      const xs = ((r.judgeScores ?? []) as JudgeScoreEntry[]).filter((s) => s.roundId === input.reviewStageId);
      return xs.length ? xs.reduce((t, s) => t + s.score, 0) / xs.length : null;
    };
    const anyTagged = eligible.some((r) => roundMean(r) !== null);
    // Legacy fallback: the live score, or (on a re-run, after the first cut
    // cleared it) this stage's own snapshot, so a re-run doesn't cut by id.
    const priorSnap = (r: (typeof rows)[number]): number | null =>
      (r.stageState ?? []).find((s) => s.stageId === input.reviewStageId)?.score ?? null;
    const cutScore = (r: (typeof rows)[number]): number | null => (anyTagged ? roundMean(r) : r.score ?? priorSnap(r));

    let advancedIds: Set<string>;
    if (input.mode === 'manual') {
      const picked = new Set(input.advancedEntryIds ?? []);
      advancedIds = new Set(eligible.filter((e) => picked.has(e.id)).map((e) => e.id));
      // Ids that match nobody in the field would eliminate everyone.
      if (advancedIds.size === 0) return { error: 'None of the picked entries is in this round' };
    } else {
      const n = Math.trunc(input.topN ?? 0);
      if (n < 1) return { error: 'Advance at least one entry' };
      const sorted = [...eligible].sort(
        (a, b) =>
          (cutScore(b) ?? -Infinity) - (cutScore(a) ?? -Infinity) ||
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          a.id.localeCompare(b.id),
      );
      advancedIds = new Set(sorted.slice(0, n).map((e) => e.id));
    }

    let advancedCount = 0;
    let eliminatedCount = 0;
    for (const e of eligible) {
      const isAdv = advancedIds.has(e.id);
      const snap = cutScore(e);
      const prior = (e.stageState ?? []).filter((s) => s.stageId !== input.reviewStageId);
      const next = [...prior, { stageId: input.reviewStageId, status: isAdv ? ('advanced' as const) : ('eliminated' as const), score: snap === null ? null : Math.round(snap), rank: e.rank ?? null }];
      // The next review round starts from a clean live score, so an entry that
      // round never scores can't rank on this round's number. The snapshot above
      // keeps this round's result. After the LAST review round the live score is
      // left alone: final ranks are computed from it.
      const patch = hasLaterReview ? { stageState: next, score: null } : { stageState: next };
      await tx.update(contestEntries).set(patch).where(eq(contestEntries.id, e.id));
      if (isAdv) advancedCount++;
      else eliminatedCount++;
    }

    // Only ever move FORWARD. Re-running an earlier round must not drag the
    // contest back to the stage after it.
    if (nextStage && isCurrent) {
      await tx.update(contests).set({ currentStageId: nextStage.id, updatedAt: new Date() }).where(eq(contests.id, contestId));
    }

    return { advancedCount, eliminatedCount, eligible: eligible.map((e) => ({ id: e.id, userId: e.userId })), advancedIds };
  });

  if ('error' in outcome) return fail(outcome.error);
  const { advancedCount, eliminatedCount, eligible, advancedIds } = outcome;

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
          // Its own link per round: notifications de-dupe on (user, type, actor,
          // link), so sharing the bare contest link let a later status notice
          // from the same organizer overwrite "You advanced!" in place.
          link: `/contests/${info.slug}?round=${encodeURIComponent(input.reviewStageId)}`,
          actorId: userId,
        }).catch(() => {});
      }
    }
  } catch {
    /* non-critical */
  }

  return { advanced: true, advancedCount, eliminatedCount };
}
