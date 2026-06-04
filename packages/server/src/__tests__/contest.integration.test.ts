import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContest,
  canCreateContest,
  listContests,
  getContestBySlug,
  updateContest,
  deleteContest,
  submitContestEntry,
  judgeContestEntry,
  transitionContestStatus,
  listContestEntries,
  withdrawContestEntry,
  calculateContestRanks,
  shouldRevealScores,
  canViewContest,
  advanceContestStage,
  isEliminated,
} from '../contest/contest.js';
import {
  addContestStakeholder,
  removeContestStakeholder,
  listContestStakeholders,
  isContestStakeholder,
} from '../contest/stakeholders.js';
import { createContent, publishContent } from '../content/content.js';
import { addContestJudge, acceptJudgeInvite, listContestJudges, isContestJudge, updateJudgeRole } from '../contest/judges.js';
import { voteOnContestEntry, removeContestEntryVote, getContestEntryVotes } from '../voting/voting.js';
import { notifications } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

describe('contest integration', () => {
  let db: DB;
  let organizerId: string;
  let participantId: string;
  let judgeUserId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const organizer = await createTestUser(db, { username: 'organizer' });
    organizerId = organizer.id;
    const participant = await createTestUser(db, { username: 'participant' });
    participantId = participant.id;
    const judge = await createTestUser(db, { username: 'judge' });
    judgeUserId = judge.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  function makeContestInput(overrides: Partial<{ title: string; slug: string; description: string }> = {}) {
    const title = overrides.title ?? 'Test Contest';
    const slug = overrides.slug ?? `test-contest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      title,
      slug,
      description: overrides.description ?? 'A test contest',
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-05-01').toISOString(),
      createdBy: organizerId,
    };
  }

  it('creates a contest', async () => {
    const contest = await createContest(db, makeContestInput({
      title: 'TinyML Challenge 2026',
      slug: 'tinyml-challenge-2026',
    }));

    expect(contest).toBeDefined();
    expect(contest.id).toBeDefined();
    expect(contest.title).toBe('TinyML Challenge 2026');
    expect(contest.slug).toBe('tinyml-challenge-2026');
    // Default status is 'upcoming' (not draft)
    expect(contest.status).toBe('upcoming');
    // New contests default to the empty (synthesized) stage timeline.
    expect(contest.stages).toEqual([]);
    expect(contest.currentStageId).toBeNull();
  });

  it('persists stages + currentStageId and drops a stale pointer', async () => {
    const stages = [
      { id: 's1', name: 'Proposals', kind: 'submission' as const },
      { id: 's2', name: 'Top 50', kind: 'review' as const },
    ];
    const c = await createContest(db, { ...makeContestInput({ title: 'Staged' }), stages, currentStageId: 's2' });
    expect(c.stages.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(c.currentStageId).toBe('s2');

    // A currentStageId that doesn't reference an existing stage is dropped on create.
    const c2 = await createContest(db, { ...makeContestInput({ title: 'Staged2' }), stages, currentStageId: 'nope' });
    expect(c2.currentStageId).toBeNull();

    // Reset-to-standard (stages = []) clears the now-stale currentStageId.
    const updated = await updateContest(db, c.slug, organizerId, { stages: [] });
    expect(updated?.stages).toEqual([]);
    expect(updated?.currentStageId).toBeNull();
  });

  it('advanceContestStage: topN cull snapshots, moves currentStageId, scopes ranks (Phase B2)', async () => {
    const reviewId = 'rev-1';
    const nextId = 'final-1';
    const stages = [
      { id: 'sub-1', name: 'Round 1 Submissions', kind: 'submission' as const },
      { id: reviewId, name: 'Top 2 Selection', kind: 'review' as const },
      { id: nextId, name: 'Final Judging', kind: 'review' as const },
    ];
    const contest = await createContest(db, {
      ...makeContestInput({ title: `Advance ${Date.now()}` }),
      stages,
      currentStageId: reviewId,
      judges: [judgeUserId],
    });
    await addContestJudge(db, contest.id, judgeUserId, 'judge');
    await acceptJudgeInvite(db, contest.id, judgeUserId);

    // Submit three entries, then judge them. Scores are DELIBERATELY out of
    // insertion order — the lowest scorer (lowScore) is submitted FIRST — so a
    // buggy insertion-order cut (slice(0,2)) would advance the wrong entries and
    // fail this test, proving the cut is genuinely by score.
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entries: { id: string; title: string; score: number }[] = [];
    for (const [title, score] of [['low', 40], ['high', 90], ['mid', 70]] as const) {
      const u = await createTestUser(db, { username: `adv-${title}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
      const content = await createContent(db, u.id, { type: 'project', title });
      await publishContent(db, content.id, u.id);
      const e = await submitContestEntry(db, contest.id, content.id, u.id);
      entries.push({ id: e!.id, title, score });
    }
    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    for (const e of entries) await judgeContestEntry(db, e.id, e.score, judgeUserId);
    const idOf = (t: string) => entries.find((e) => e.title === t)!.id;
    const low = idOf('low'); // 40, submitted 1st
    const high = idOf('high'); // 90, submitted 2nd
    const mid = idOf('mid'); // 70, submitted 3rd

    // Cut to the top 2 by SCORE → high (90) + mid (70) advance, low (40) is out.
    const res = await advanceContestStage(db, contest.id, organizerId, { reviewStageId: reviewId, mode: 'topN', topN: 2 });
    expect(res.advanced).toBe(true);
    expect(res.advancedCount).toBe(2);
    expect(res.eliminatedCount).toBe(1);

    // currentStageId moved to the next stage.
    expect((await getContestBySlug(db, contest.slug))?.currentStageId).toBe(nextId);

    // The lowest scorer (submitted FIRST) is the one eliminated — not an
    // insertion-order pick.
    const byId = Object.fromEntries((await listContestEntries(db, contest.id, { limit: 50 })).items.map((e) => [e.id, e]));
    expect(byId[low]!.eliminated).toBe(true);
    expect(byId[high]!.eliminated).toBe(false);
    expect(byId[mid]!.eliminated).toBe(false);
    expect(isEliminated({ stageState: byId[low]!.stageState })).toBe(true);

    // Ranks: survivors ranked by score (high=1, mid=2); the eliminated entry has no rank.
    await calculateContestRanks(db, contest.id);
    const ranks = Object.fromEntries((await listContestEntries(db, contest.id, { limit: 50 })).items.map((e) => [e.id, e.rank]));
    expect(ranks[high]).toBe(1);
    expect(ranks[mid]).toBe(2);
    expect(ranks[low]).toBeNull();

    // Idempotent: re-running the same cut doesn't duplicate stageState rows.
    await advanceContestStage(db, contest.id, organizerId, { reviewStageId: reviewId, mode: 'topN', topN: 2 });
    const lowEntry = (await listContestEntries(db, contest.id, { limit: 50 })).items.find((e) => e.id === low)!;
    expect(lowEntry.stageState.filter((s) => s.stageId === reviewId)).toHaveLength(1);

    // Cohort gate (G2): the eliminated entry can no longer be scored; survivors can.
    const rejected = await judgeContestEntry(db, low, 50, judgeUserId);
    expect(rejected.judged).toBe(false);
    expect(rejected.error).toMatch(/not advanced/i);
    const ok = await judgeContestEntry(db, high, 95, judgeUserId);
    expect(ok.judged).toBe(true);
  });

  it('end-to-end: multi-round contest (proposals → Top-N cull → sprint → final judging → ranks)', async () => {
    // Resilient-America shape: 2 review rounds with different criteria + a cull.
    const stages = [
      { id: 'sub', name: 'Proposals Open', kind: 'submission' as const },
      { id: 'r1', name: 'Top 2 Selection', kind: 'review' as const, advanceCount: 2,
        criteria: [{ label: 'Community impact' }, { label: 'Feasibility' }] },
      { id: 'sprint', name: 'Hardware Sprint', kind: 'interim' as const },
      { id: 'r2', name: 'Final Judging', kind: 'review' as const,
        criteria: [{ label: 'Deployment readiness' }] },
      { id: 'finale', name: 'Finale — D.C.', kind: 'event' as const, location: 'Washington, D.C.' },
    ];
    const contest = await createContest(db, {
      ...makeContestInput({ title: `E2E ${Date.now()}` }),
      stages,
      currentStageId: 'sub',
      judges: [judgeUserId],
    });
    await addContestJudge(db, contest.id, judgeUserId, 'judge');
    await acceptJudgeInvite(db, contest.id, judgeUserId);

    // Stage config persisted (per-round criteria + advanceCount).
    const loaded = await getContestBySlug(db, contest.slug);
    expect(loaded!.stages.find((s) => s.id === 'r1')!.advanceCount).toBe(2);
    expect(loaded!.stages.find((s) => s.id === 'r1')!.criteria).toHaveLength(2);
    expect(loaded!.currentStageId).toBe('sub');

    // Submit 3 proposals while active.
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entries: { id: string; user: string }[] = [];
    for (const title of ['A', 'B', 'C']) {
      const u = await createTestUser(db, { username: `e2e-${title}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
      const content = await createContent(db, u.id, { type: 'project', title });
      await publishContent(db, content.id, u.id);
      const e = await submitContestEntry(db, contest.id, content.id, u.id);
      entries.push({ id: e!.id, user: u.id });
    }
    const [a, b, c] = entries.map((e) => e.id);

    // ── Round 1: judge all 3 proposals. Scores out of insertion order — B
    // (submitted 2nd) is the LOWEST, so the cut can't be an insertion-order pick.
    // A=90, B=40, C=70 → top 2 by score = A + C; B is eliminated.
    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    await updateContest(db, contest.slug, organizerId, { currentStageId: 'r1' });
    await judgeContestEntry(db, a, 90, judgeUserId);
    await judgeContestEntry(db, b, 40, judgeUserId);
    await judgeContestEntry(db, c, 70, judgeUserId);

    // Cut to the top 2 (the stage's advanceCount).
    const adv = await advanceContestStage(db, contest.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 2 });
    expect(adv.advancedCount).toBe(2);
    expect(adv.eliminatedCount).toBe(1);
    expect((await getContestBySlug(db, contest.slug))!.currentStageId).toBe('sprint'); // moved to next stage

    // B (lowest, submitted 2nd) eliminated; A + C survive. Round-1 score snapshotted.
    const afterCut = (await listContestEntries(db, contest.id, { limit: 50 })).items;
    const byId = Object.fromEntries(afterCut.map((e) => [e.id, e]));
    expect(byId[b]!.eliminated).toBe(true);
    expect(byId[a]!.eliminated).toBe(false);
    expect(byId[c]!.eliminated).toBe(false);
    expect(byId[a]!.stageState.find((s) => s.stageId === 'r1')!.score).toBe(90);

    // ── Round 2: only survivors (A, C) are judgeable ──
    await updateContest(db, contest.slug, organizerId, { currentStageId: 'r2' });
    const rejectB = await judgeContestEntry(db, b, 99, judgeUserId); // eliminated → blocked
    expect(rejectB.judged).toBe(false);
    expect(rejectB.error).toMatch(/not advanced/i);
    // Re-score the 2 finalists on the prototype; C now beats A.
    expect((await judgeContestEntry(db, a, 85, judgeUserId)).judged).toBe(true);
    expect((await judgeContestEntry(db, c, 95, judgeUserId)).judged).toBe(true);

    // Per-round isolation: A's round-1 score (90) is preserved tagged 'r1' alongside
    // its round-2 score (85) tagged 'r2', and the live `score` reflects ONLY round 2.
    const aEntry = (await listContestEntries(db, contest.id, { limit: 50, includeJudgeScores: true })).items.find((e) => e.id === a)!;
    const aMine = (aEntry.judgeScores ?? []).filter((s) => s.judgeId === judgeUserId);
    expect(aMine.find((s) => s.roundId === 'r1')?.score).toBe(90);
    expect(aMine.find((s) => s.roundId === 'r2')?.score).toBe(85);
    expect(aEntry.score).toBe(85); // live aggregate = current (round-2) only, NOT blended with round 1

    // ── Finale: complete → ranks over the surviving cohort only (by round-2 score) ──
    await transitionContestStatus(db, contest.id, organizerId, 'completed');
    const final = Object.fromEntries((await listContestEntries(db, contest.id, { limit: 50 })).items.map((e) => [e.id, e]));
    expect(final[c]!.rank).toBe(1); // 95
    expect(final[a]!.rank).toBe(2); // 85
    expect(final[b]!.rank).toBeNull(); // eliminated — never ranked
  });

  it('advanceContestStage: rejects non-owner + non-review stage', async () => {
    const stages = [{ id: 'sub', name: 'Subs', kind: 'submission' as const }, { id: 'rev', name: 'Judge', kind: 'review' as const }];
    const contest = await createContest(db, { ...makeContestInput({ title: `Adv guard ${Date.now()}` }), stages });
    const outsider = await createTestUser(db, { username: `adv-out-${Date.now()}` });
    expect((await advanceContestStage(db, contest.id, outsider.id, { reviewStageId: 'rev', mode: 'topN', topN: 1 })).error).toMatch(/owner/i);
    expect((await advanceContestStage(db, contest.id, organizerId, { reviewStageId: 'sub', mode: 'topN', topN: 1 })).error).toMatch(/review/i);
  });

  it('lists contests', async () => {
    const result = await listContests(db);

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('gets contest by slug', async () => {
    const created = await createContest(db, makeContestInput({
      title: 'Slug Test Contest',
      slug: 'slug-test-contest',
    }));

    const found = await getContestBySlug(db, created.slug);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Slug Test Contest');
  });

  it('updates a contest', async () => {
    const created = await createContest(db, makeContestInput({
      title: 'Old Contest Title',
      slug: 'old-contest-title',
    }));

    const updated = await updateContest(db, created.slug, organizerId, {
      title: 'New Contest Title',
      description: 'Updated rules',
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('New Contest Title');
  });

  it('transitions contest status', async () => {
    const contest = await createContest(db, makeContestInput({
      title: 'Status Test Contest',
    }));

    // upcoming → active
    const activated = await transitionContestStatus(db, contest.id, organizerId, 'active');
    expect(activated.transitioned).toBe(true);

    // active → judging
    const judging = await transitionContestStatus(db, contest.id, organizerId, 'judging');
    expect(judging.transitioned).toBe(true);

    // judging → completed
    const completed = await transitionContestStatus(db, contest.id, organizerId, 'completed');
    expect(completed.transitioned).toBe(true);
  });

  it('rejects invalid status transitions', async () => {
    const contest = await createContest(db, makeContestInput({
      title: 'Bad Transition Contest',
    }));

    // upcoming → judging (skip active — should fail)
    const result = await transitionContestStatus(db, contest.id, organizerId, 'judging');
    expect(result.transitioned).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('submits and lists contest entries', async () => {
    const contest = await createContest(db, makeContestInput({
      title: 'Entry Test Contest',
    }));

    // Open the contest: upcoming → active
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    // Create and publish content for entry (submitContestEntry requires published content)
    const content = await createContent(db, participantId, {
      type: 'project',
      title: 'My Contest Entry',
    });
    await publishContent(db, content.id, participantId);

    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    expect(entry).not.toBeNull();
    expect(entry!.contestId).toBe(contest.id);
    expect(entry!.userId).toBe(participantId);

    const { items: entries } = await listContestEntries(db, contest.id);
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('judges a contest entry', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Judging Test Contest' }),
      judges: [judgeUserId],
    });

    // Register judge in contestJudges table and accept invite
    await addContestJudge(db, contest.id, judgeUserId, 'judge');
    await acceptJudgeInvite(db, contest.id, judgeUserId);

    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const content = await createContent(db, participantId, {
      type: 'project',
      title: 'Judged Entry',
    });
    await publishContent(db, content.id, participantId);

    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    expect(entry).not.toBeNull();

    // Move to judging
    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    const result = await judgeContestEntry(db, entry!.id, 85, judgeUserId, 'Great work!');
    expect(result).toBeDefined();
    expect(result.judged).toBe(true);
  });

  it('deletes a contest', async () => {
    const created = await createContest(db, makeContestInput({
      title: 'To Delete Contest',
    }));

    const deleted = await deleteContest(db, created.id, organizerId);
    expect(deleted).toBe(true);
  });

  describe('contest creation permissions', () => {
    it('canCreateContest allows anyone when policy is open', () => {
      expect(canCreateContest('member', 'open')).toBe(true);
      expect(canCreateContest('pro', 'open')).toBe(true);
      expect(canCreateContest('verified', 'open')).toBe(true);
      expect(canCreateContest('staff', 'open')).toBe(true);
      expect(canCreateContest('admin', 'open')).toBe(true);
    });

    it('canCreateContest restricts to staff+ when policy is staff', () => {
      expect(canCreateContest('member', 'staff')).toBe(false);
      expect(canCreateContest('pro', 'staff')).toBe(false);
      expect(canCreateContest('verified', 'staff')).toBe(false);
      expect(canCreateContest('staff', 'staff')).toBe(true);
      expect(canCreateContest('admin', 'staff')).toBe(true);
    });

    it('canCreateContest restricts to admin only when policy is admin', () => {
      expect(canCreateContest('member', 'admin')).toBe(false);
      expect(canCreateContest('pro', 'admin')).toBe(false);
      expect(canCreateContest('verified', 'admin')).toBe(false);
      expect(canCreateContest('staff', 'admin')).toBe(false);
      expect(canCreateContest('admin', 'admin')).toBe(true);
    });

    it('defaults to admin policy when not specified', () => {
      expect(canCreateContest('admin')).toBe(true);
      expect(canCreateContest('staff')).toBe(false);
      expect(canCreateContest('member')).toBe(false);
    });

    it('createContest throws when user lacks permission', async () => {
      await expect(
        createContest(db, makeContestInput({ slug: `perm-test-${Date.now()}` }), {
          userRole: 'member',
          contestCreationPolicy: 'admin',
        }),
      ).rejects.toThrow('Insufficient permissions');
    });

    it('createContest succeeds when user has permission', async () => {
      const contest = await createContest(db, makeContestInput({ slug: `perm-ok-${Date.now()}` }), {
        userRole: 'admin',
        contestCreationPolicy: 'admin',
      });
      expect(contest.id).toBeDefined();
    });

    it('createContest works without options (backward compatible)', async () => {
      const contest = await createContest(db, makeContestInput({ slug: `compat-${Date.now()}` }));
      expect(contest.id).toBeDefined();
    });
  });

  // --- New tests: rank calc, withdrawal, feedback, cancellation, multi-judge ---

  it('auto-ranks entries on completion transition', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Rank Calc Contest' }),
      judges: [judgeUserId],
    });
    await addContestJudge(db, contest.id, judgeUserId, 'judge');
    await acceptJudgeInvite(db, contest.id, judgeUserId);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    // Create two entries
    const c1 = await createContent(db, participantId, { type: 'project', title: 'Entry A' });
    await publishContent(db, c1.id, participantId);
    const e1 = await submitContestEntry(db, contest.id, c1.id, participantId);

    const participant2 = await createTestUser(db, { username: `p2-${Date.now()}` });
    const c2 = await createContent(db, participant2.id, { type: 'project', title: 'Entry B' });
    await publishContent(db, c2.id, participant2.id);
    const e2 = await submitContestEntry(db, contest.id, c2.id, participant2.id);

    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    // Score: e2 higher than e1
    await judgeContestEntry(db, e1!.id, 60, judgeUserId);
    await judgeContestEntry(db, e2!.id, 90, judgeUserId);

    // Complete triggers rank calc
    await transitionContestStatus(db, contest.id, organizerId, 'completed');

    const { items } = await listContestEntries(db, contest.id);
    const ranked1 = items.find((i) => i.id === e1!.id);
    const ranked2 = items.find((i) => i.id === e2!.id);
    expect(ranked2!.rank).toBe(1); // Higher score = rank 1
    expect(ranked1!.rank).toBe(2);
  });

  it('withdraws entry from active contest', async () => {
    const contest = await createContest(db, makeContestInput({ title: 'Withdraw Test' }));
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const content = await createContent(db, participantId, { type: 'project', title: 'To Withdraw' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    expect(entry).not.toBeNull();

    const result = await withdrawContestEntry(db, entry!.id, participantId);
    expect(result.withdrawn).toBe(true);

    const { items } = await listContestEntries(db, contest.id);
    expect(items.find((i) => i.id === entry!.id)).toBeUndefined();
  });

  it('rejects withdrawal from judging contest', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'No Withdraw Judging' }),
      judges: [judgeUserId],
    });
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const content = await createContent(db, participantId, { type: 'project', title: 'Stuck Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    const result = await withdrawContestEntry(db, entry!.id, participantId);
    expect(result.withdrawn).toBe(false);
    expect(result.error).toContain('active');
  });

  it('rejects withdrawal by wrong user', async () => {
    const contest = await createContest(db, makeContestInput({ title: 'Wrong User Withdraw' }));
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const content = await createContent(db, participantId, { type: 'project', title: 'Not Yours' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    const result = await withdrawContestEntry(db, entry!.id, organizerId);
    expect(result.withdrawn).toBe(false);
    expect(result.error).toContain('owner');
  });

  it('stores judge feedback in judgeScores', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Feedback Test Contest' }),
      judges: [judgeUserId],
    });
    await addContestJudge(db, contest.id, judgeUserId, 'judge');
    await acceptJudgeInvite(db, contest.id, judgeUserId);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const content = await createContent(db, participantId, { type: 'project', title: 'Feedback Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    await judgeContestEntry(db, entry!.id, 75, judgeUserId, 'Excellent craftsmanship!');

    const { items } = await listContestEntries(db, contest.id, { includeJudgeScores: true });
    const judged = items.find((i) => i.id === entry!.id);
    expect(judged!.judgeScores).toBeDefined();
    expect(judged!.judgeScores![0]!.feedback).toBe('Excellent craftsmanship!');
  });

  it('cancels contest from each valid state', async () => {
    // Cancel from upcoming
    const c1 = await createContest(db, makeContestInput({ title: 'Cancel Upcoming' }));
    const r1 = await transitionContestStatus(db, c1.id, organizerId, 'cancelled');
    expect(r1.transitioned).toBe(true);

    // Cancel from active
    const c2 = await createContest(db, makeContestInput({ title: 'Cancel Active' }));
    await transitionContestStatus(db, c2.id, organizerId, 'active');
    const r2 = await transitionContestStatus(db, c2.id, organizerId, 'cancelled');
    expect(r2.transitioned).toBe(true);

    // Cancel from judging
    const c3 = await createContest(db, {
      ...makeContestInput({ title: 'Cancel Judging' }),
      judges: [judgeUserId],
    });
    await transitionContestStatus(db, c3.id, organizerId, 'active');
    await transitionContestStatus(db, c3.id, organizerId, 'judging');
    const r3 = await transitionContestStatus(db, c3.id, organizerId, 'cancelled');
    expect(r3.transitioned).toBe(true);
  });

  it('reopens a cancelled contest to draft/upcoming but not mid-lifecycle', async () => {
    const contest = await createContest(db, makeContestInput({ title: 'Cancelled Reopen' }));
    await transitionContestStatus(db, contest.id, organizerId, 'cancelled');

    // Can't jump straight back into the running/terminal lifecycle.
    const r1 = await transitionContestStatus(db, contest.id, organizerId, 'active');
    expect(r1.transitioned).toBe(false);
    const rC = await transitionContestStatus(db, contest.id, organizerId, 'completed');
    expect(rC.transitioned).toBe(false);

    // But it can be reopened to upcoming, then relaunched normally.
    const r2 = await transitionContestStatus(db, contest.id, organizerId, 'upcoming');
    expect(r2.transitioned).toBe(true);
  });

  it('averages scores from multiple judges', async () => {
    const judge2 = await createTestUser(db, { username: `judge2-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Multi-Judge Contest' }),
      judges: [judgeUserId, judge2.id],
    });
    await addContestJudge(db, contest.id, judgeUserId, 'judge');
    await acceptJudgeInvite(db, contest.id, judgeUserId);
    await addContestJudge(db, contest.id, judge2.id, 'judge');
    await acceptJudgeInvite(db, contest.id, judge2.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const content = await createContent(db, participantId, { type: 'project', title: 'Multi-Judge Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    await judgeContestEntry(db, entry!.id, 80, judgeUserId);
    await judgeContestEntry(db, entry!.id, 90, judge2.id);

    const { items } = await listContestEntries(db, contest.id);
    const scored = items.find((i) => i.id === entry!.id);
    // Average of 80 and 90 = 85
    expect(scored!.score).toBe(85);
  });

  // --- Judge unification, score gating, ranking, new config fields ---

  it('seeds the contest_judges table from create input (single source of truth)', async () => {
    const judge = await createTestUser(db, { username: `seedjudge-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Seeded Judges Contest' }),
      judges: [judge.id],
    });

    // The judge is in the table without a separate addContestJudge call.
    const panel = await listContestJudges(db, contest.id);
    expect(panel.map((j) => j.userId)).toContain(judge.id);
    expect(await isContestJudge(db, contest.id, judge.id)).toBe(true);

    // Accept-then-score works end to end without addContestJudge.
    await acceptJudgeInvite(db, contest.id, judge.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Seeded Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    const result = await judgeContestEntry(db, entry!.id, 70, judge.id);
    expect(result.judged).toBe(true);
  });

  it('hides aggregate scores when revealScores is false', async () => {
    const judge = await createTestUser(db, { username: `gatejudge-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Score Gate Contest' }),
      judges: [judge.id],
    });
    await acceptJudgeInvite(db, contest.id, judge.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Gated Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    await judgeContestEntry(db, entry!.id, 88, judge.id);

    const hidden = await listContestEntries(db, contest.id, { revealScores: false });
    expect(hidden.items.find((i) => i.id === entry!.id)!.score).toBeNull();

    const shown = await listContestEntries(db, contest.id, { revealScores: true });
    expect(shown.items.find((i) => i.id === entry!.id)!.score).toBe(88);

    // Judge feedback is omitted unless includeJudgeScores is requested.
    expect(shown.items[0]!.judgeScores).toBeUndefined();
  });

  it('shares rank for tied scores and leaves unscored entries unranked', async () => {
    const judge = await createTestUser(db, { username: `rankjudge-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Tie Rank Contest' }),
      judges: [judge.id],
    });
    await acceptJudgeInvite(db, contest.id, judge.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const mkEntry = async (userIdx: number, title: string) => {
      const u = await createTestUser(db, { username: `rank-u${userIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
      const c = await createContent(db, u.id, { type: 'project', title });
      await publishContent(db, c.id, u.id);
      return submitContestEntry(db, contest.id, c.id, u.id);
    };
    const eA = await mkEntry(1, 'Tie A');
    const eB = await mkEntry(2, 'Tie B');
    const eC = await mkEntry(3, 'Unscored C');

    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    await judgeContestEntry(db, eA!.id, 90, judge.id);
    await judgeContestEntry(db, eB!.id, 90, judge.id);
    // eC is never scored.

    await transitionContestStatus(db, contest.id, organizerId, 'completed');

    const { items } = await listContestEntries(db, contest.id);
    const a = items.find((i) => i.id === eA!.id)!;
    const b = items.find((i) => i.id === eB!.id)!;
    const c = items.find((i) => i.id === eC!.id)!;
    // Tied scores share rank 1 (RANK(), not ROW_NUMBER()).
    expect(a.rank).toBe(1);
    expect(b.rank).toBe(1);
    // Unscored entry stays unranked.
    expect(c.rank).toBeNull();
  });

  it('persists community voting, judging visibility, and criteria on create and update', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Config Fields Contest' }),
      communityVotingEnabled: true,
      judgingVisibility: 'public',
      judgingCriteria: [
        { label: 'Documentation', weight: 20, description: 'Clear build log' },
        { label: 'Creativity', weight: 30 },
      ],
    });
    expect(contest.communityVotingEnabled).toBe(true);
    expect(contest.judgingVisibility).toBe('public');
    expect(contest.judgingCriteria).toHaveLength(2);
    expect(contest.judgingCriteria![0]!.label).toBe('Documentation');

    const updated = await updateContest(db, contest.slug, organizerId, {
      communityVotingEnabled: false,
      judgingVisibility: 'private',
      judgingCriteria: [{ label: 'Impact', weight: 100 }],
    });
    expect(updated!.communityVotingEnabled).toBe(false);
    expect(updated!.judgingVisibility).toBe('private');
    expect(updated!.judgingCriteria).toHaveLength(1);
    expect(updated!.judgingCriteria![0]!.label).toBe('Impact');
  });

  it('supports category prizes alongside place-based prizes', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Category Prizes Contest' }),
      prizes: [
        { place: 1, title: 'Grand Prize', value: '$1000' },
        { category: 'Best in Show', title: 'Editor Pick', value: 'Trophy' },
      ],
    });
    expect(contest.prizes).toHaveLength(2);
    expect(contest.prizes![0]!.place).toBe(1);
    expect(contest.prizes![1]!.category).toBe('Best in Show');
    expect(contest.prizes![1]!.place).toBeUndefined();
  });

  // --- shouldRevealScores: exhaustive pure-logic matrix ---

  describe('shouldRevealScores (judging visibility)', () => {
    const statuses = ['upcoming', 'active', 'judging', 'completed', 'cancelled'] as const;

    it('always reveals to privileged viewers regardless of visibility/status', () => {
      for (const v of ['public', 'judges-only', 'private'] as const) {
        for (const s of statuses) {
          expect(shouldRevealScores(v, s, true)).toBe(true);
        }
      }
    });

    it('public: reveals to everyone in every status', () => {
      for (const s of statuses) expect(shouldRevealScores('public', s, false)).toBe(true);
    });

    it('private: never reveals to non-privileged, even when completed', () => {
      for (const s of statuses) expect(shouldRevealScores('private', s, false)).toBe(false);
    });

    it('judges-only: hides from public until completed', () => {
      expect(shouldRevealScores('judges-only', 'active', false)).toBe(false);
      expect(shouldRevealScores('judges-only', 'judging', false)).toBe(false);
      expect(shouldRevealScores('judges-only', 'completed', false)).toBe(true);
    });
  });

  // --- Judge authorization edge cases ---

  it('rejects scoring by a guest judge', async () => {
    const guest = await createTestUser(db, { username: `guest-${Date.now()}` });
    const contest = await createContest(db, makeContestInput({ title: 'Guest Judge Contest' }));
    await addContestJudge(db, contest.id, guest.id, 'guest');
    await acceptJudgeInvite(db, contest.id, guest.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Guest-judged Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    const result = await judgeContestEntry(db, entry!.id, 80, guest.id);
    expect(result.judged).toBe(false);
    expect(result.error).toMatch(/guest/i);
  });

  it('rejects scoring by a judge who has not accepted the invite', async () => {
    const judge = await createTestUser(db, { username: `unaccepted-${Date.now()}` });
    const contest = await createContest(db, makeContestInput({ title: 'Unaccepted Judge Contest' }));
    await addContestJudge(db, contest.id, judge.id, 'judge'); // no acceptJudgeInvite
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Unaccepted Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    const result = await judgeContestEntry(db, entry!.id, 80, judge.id);
    expect(result.judged).toBe(false);
    expect(result.error).toMatch(/accept/i);
  });

  it('promotes a guest to judge so they can then score', async () => {
    const u = await createTestUser(db, { username: `promote-${Date.now()}` });
    const contest = await createContest(db, makeContestInput({ title: 'Promote Judge Contest' }));
    await addContestJudge(db, contest.id, u.id, 'guest');
    await acceptJudgeInvite(db, contest.id, u.id);
    await updateJudgeRole(db, contest.id, u.id, 'judge');
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Promote Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    const result = await judgeContestEntry(db, entry!.id, 77, u.id);
    expect(result.judged).toBe(true);
  });

  it('rejects status transition by a non-owner', async () => {
    const contest = await createContest(db, makeContestInput({ title: 'Owner-only Transition' }));
    const r = await transitionContestStatus(db, contest.id, participantId, 'active');
    expect(r.transitioned).toBe(false);
    expect(r.error).toMatch(/owner/i);
  });

  it('acceptJudgeInvite is idempotent and rejects when no invite exists', async () => {
    const judge = await createTestUser(db, { username: `accept-${Date.now()}` });
    const contest = await createContest(db, makeContestInput({ title: 'Accept Edge Contest' }));
    // No invite yet.
    expect(await acceptJudgeInvite(db, contest.id, judge.id)).toBe(false);
    await addContestJudge(db, contest.id, judge.id, 'judge');
    expect(await acceptJudgeInvite(db, contest.id, judge.id)).toBe(true);
    // Already accepted → false.
    expect(await acceptJudgeInvite(db, contest.id, judge.id)).toBe(false);
  });

  // --- Community voting ---

  it('community voting: gated by flag, one vote per user, removable, counted', async () => {
    const voter = await createTestUser(db, { username: `voter-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Voting Contest' }),
      communityVotingEnabled: true,
    });
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Votable Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    const v1 = await voteOnContestEntry(db, entry!.id, voter.id);
    expect(v1.voted).toBe(true);
    // Duplicate vote rejected.
    const v2 = await voteOnContestEntry(db, entry!.id, voter.id);
    expect(v2.voted).toBe(false);

    let votes = await getContestEntryVotes(db, contest.id, voter.id);
    expect(votes.find((x) => x.entryId === entry!.id)).toMatchObject({ count: 1, voted: true });

    expect(await removeContestEntryVote(db, entry!.id, voter.id)).toBe(true);
    votes = await getContestEntryVotes(db, contest.id, null);
    expect(votes.find((x) => x.entryId === entry!.id)!.count).toBe(0);
  });

  it('community voting: rejected when the contest has it disabled', async () => {
    const voter = await createTestUser(db, { username: `novote-${Date.now()}` });
    const contest = await createContest(db, makeContestInput({ title: 'No Voting Contest' }));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Unvotable Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    const r = await voteOnContestEntry(db, entry!.id, voter.id);
    expect(r.voted).toBe(false);
    expect(r.error).toMatch(/not enabled/i);
  });

  it('community voting: rejects voting for your own entry', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Self Vote Contest' }),
      communityVotingEnabled: true,
    });
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'My Own Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);

    const r = await voteOnContestEntry(db, entry!.id, participantId); // author votes for self
    expect(r.voted).toBe(false);
    expect(r.error).toMatch(/your own/i);
  });

  // --- Entry eligibility + per-user cap (session 172 flexibility) ---

  it('rejects entries whose content type is not eligible', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Projects Only Contest' }),
      eligibleContentTypes: ['project'],
    });
    expect(contest.eligibleContentTypes).toEqual(['project']);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const blog = await createContent(db, participantId, { type: 'blog', title: 'A Blog Post' });
    await publishContent(db, blog.id, participantId);
    const rejected = await submitContestEntry(db, contest.id, blog.id, participantId);
    expect(rejected).toBeNull();

    const project = await createContent(db, participantId, { type: 'project', title: 'A Project' });
    await publishContent(db, project.id, participantId);
    const accepted = await submitContestEntry(db, contest.id, project.id, participantId);
    expect(accepted).not.toBeNull();
  });

  it('enforces maxEntriesPerUser', async () => {
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'One Entry Each Contest' }),
      maxEntriesPerUser: 1,
    });
    expect(contest.maxEntriesPerUser).toBe(1);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const c1 = await createContent(db, participantId, { type: 'project', title: 'First Entry' });
    await publishContent(db, c1.id, participantId);
    const e1 = await submitContestEntry(db, contest.id, c1.id, participantId);
    expect(e1).not.toBeNull();

    const c2 = await createContent(db, participantId, { type: 'project', title: 'Second Entry' });
    await publishContent(db, c2.id, participantId);
    const e2 = await submitContestEntry(db, contest.id, c2.id, participantId);
    expect(e2).toBeNull(); // cap reached

    // A different user is unaffected by the first user's cap.
    const other = await createTestUser(db, { username: `cap-other-${Date.now()}` });
    const c3 = await createContent(db, other.id, { type: 'project', title: 'Other Entry' });
    await publishContent(db, c3.id, other.id);
    const e3 = await submitContestEntry(db, contest.id, c3.id, other.id);
    expect(e3).not.toBeNull();
  });

  it('updateContest persists eligibility + cap and ignores judges', async () => {
    const contest = await createContest(db, makeContestInput({ title: 'Update Flex Contest' }));
    const updated = await updateContest(db, contest.slug, organizerId, {
      eligibleContentTypes: ['project', 'explainer'],
      maxEntriesPerUser: 3,
      judges: [judgeUserId], // must be ignored — judges come from the table
    });
    expect(updated!.eligibleContentTypes).toEqual(['project', 'explainer']);
    expect(updated!.maxEntriesPerUser).toBe(3);
    // judges field is no longer part of ContestDetail; the table is untouched by update.
    const panel = await listContestJudges(db, contest.id);
    expect(panel).toHaveLength(0);
  });

  // --- Full happy-path lifecycle (the "can a full contest occur" proof) ---

  it('runs a complete contest end to end: create → judges → submit → judge → complete → results', async () => {
    const j1 = await createTestUser(db, { username: `e2e-j1-${Date.now()}` });
    const j2 = await createTestUser(db, { username: `e2e-j2-${Date.now()}` });
    const alice = await createTestUser(db, { username: `e2e-alice-${Date.now()}` });
    const bob = await createTestUser(db, { username: `e2e-bob-${Date.now()}` });
    const fan = await createTestUser(db, { username: `e2e-fan-${Date.now()}` });

    // 1. Create with the full customization surface + seed judges.
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'E2E Maker Challenge' }),
      judges: [j1.id, j2.id],
      communityVotingEnabled: true,
      judgingVisibility: 'judges-only',
      eligibleContentTypes: ['project'],
      maxEntriesPerUser: 2,
      prizes: [
        { place: 1, title: 'Grand Prize', value: '$500' },
        { category: 'Best Newcomer', title: 'Newcomer Award', value: '$100' },
      ],
      judgingCriteria: [
        { label: 'Documentation', weight: 40 },
        { label: 'Creativity', weight: 60 },
      ],
    });
    expect(contest.status).toBe('upcoming');

    // Judges seeded into the table; accept the invites.
    const panel = await listContestJudges(db, contest.id);
    expect(panel.map((p) => p.userId).sort()).toEqual([j1.id, j2.id].sort());
    await acceptJudgeInvite(db, contest.id, j1.id);
    await acceptJudgeInvite(db, contest.id, j2.id);

    // 2. Activate → submissions open.
    expect((await transitionContestStatus(db, contest.id, organizerId, 'active')).transitioned).toBe(true);

    // 3. Two makers submit projects.
    const aProj = await createContent(db, alice.id, { type: 'project', title: "Alice's Robot" });
    await publishContent(db, aProj.id, alice.id);
    const aEntry = await submitContestEntry(db, contest.id, aProj.id, alice.id);
    expect(aEntry).not.toBeNull();

    const bProj = await createContent(db, bob.id, { type: 'project', title: "Bob's Sensor" });
    await publishContent(db, bProj.id, bob.id);
    const bEntry = await submitContestEntry(db, contest.id, bProj.id, bob.id);
    expect(bEntry).not.toBeNull();

    // Community vote: fan upvotes Alice.
    expect((await voteOnContestEntry(db, aEntry!.id, fan.id)).voted).toBe(true);

    // Aggregate scores are hidden from the public during judging (judges-only).
    const publicDuringJudging = await listContestEntries(db, contest.id, {
      revealScores: shouldRevealScores('judges-only', 'judging', false),
    });
    expect(publicDuringJudging.items.every((i) => i.score === null)).toBe(true);

    // 4. Judging → both judges score both entries.
    expect((await transitionContestStatus(db, contest.id, organizerId, 'judging')).transitioned).toBe(true);
    await judgeContestEntry(db, aEntry!.id, 90, j1.id, 'Excellent docs');
    await judgeContestEntry(db, aEntry!.id, 80, j2.id);
    await judgeContestEntry(db, bEntry!.id, 70, j1.id);
    await judgeContestEntry(db, bEntry!.id, 60, j2.id);

    // 5. Complete → ranks computed.
    expect((await transitionContestStatus(db, contest.id, organizerId, 'completed')).transitioned).toBe(true);

    // 6. Results: Alice (avg 85) rank 1, Bob (avg 65) rank 2; scores now public.
    const results = await listContestEntries(db, contest.id, {
      revealScores: shouldRevealScores('judges-only', 'completed', false),
    });
    const a = results.items.find((i) => i.id === aEntry!.id)!;
    const b = results.items.find((i) => i.id === bEntry!.id)!;
    expect(a.score).toBe(85);
    expect(b.score).toBe(65);
    expect(a.rank).toBe(1);
    expect(b.rank).toBe(2);

    // Community vote tally survived.
    const votes = await getContestEntryVotes(db, contest.id, null);
    expect(votes.find((v) => v.entryId === aEntry!.id)!.count).toBe(1);
    expect(votes.find((v) => v.entryId === bEntry!.id)!.count).toBe(0);
  });

  // --- Winner notifications on completion (session 173) ---

  it('alerts the winner with a congratulatory notification naming placement + prize', async () => {
    const judge = await createTestUser(db, { username: `win-j-${Date.now()}` });
    const winner = await createTestUser(db, { username: `win-w-${Date.now()}` });
    const runnerUp = await createTestUser(db, { username: `win-r-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Winner Notify Contest' }),
      judges: [judge.id],
      prizes: [{ place: 1, title: 'Gold Prize', value: '$500' }],
    });
    await acceptJudgeInvite(db, contest.id, judge.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const wc = await createContent(db, winner.id, { type: 'project', title: 'Winning Build' });
    await publishContent(db, wc.id, winner.id);
    const wEntry = await submitContestEntry(db, contest.id, wc.id, winner.id);
    const rc = await createContent(db, runnerUp.id, { type: 'project', title: 'Runner Up Build' });
    await publishContent(db, rc.id, runnerUp.id);
    const rEntry = await submitContestEntry(db, contest.id, rc.id, runnerUp.id);

    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    await judgeContestEntry(db, wEntry!.id, 95, judge.id);
    await judgeContestEntry(db, rEntry!.id, 70, judge.id);
    await transitionContestStatus(db, contest.id, organizerId, 'completed');

    // Status-change notifications are fire-and-forget; let them settle.
    await new Promise((r) => setTimeout(r, 200));

    const winnerNotifs = await db.select().from(notifications).where(eq(notifications.userId, winner.id));
    const win = winnerNotifs.find((n) => n.title.includes('You won'));
    expect(win, 'winner should receive a "You won" notification').toBeDefined();
    expect(win!.message).toMatch(/1st/);
    expect(win!.message).toMatch(/Gold Prize/);
    expect(win!.message).toMatch(/\$500/);
    expect(win!.link).toContain('/results');

    // The runner-up (rank 2, no place-2 prize) gets the standard results note, NOT a win alert.
    const runnerNotifs = await db.select().from(notifications).where(eq(notifications.userId, runnerUp.id));
    expect(runnerNotifs.some((n) => n.title.includes('You won'))).toBe(false);
    expect(runnerNotifs.some((n) => n.title === 'Results Posted')).toBe(true);
  });

  // --- Per-criterion scoring + concurrency (session 173) ---

  async function rubricContestWithEntry(title: string) {
    const judge = await createTestUser(db, { username: `rub-j-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title }),
      judges: [judge.id],
      judgingCriteria: [
        { label: 'Documentation', weight: 20 },
        { label: 'Creativity', weight: 30 },
      ],
    });
    await acceptJudgeInvite(db, contest.id, judge.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: `${title} entry` });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');
    return { contest, judge, entry: entry! };
  }

  it('scores by criteria and computes the normalized weighted overall', async () => {
    const { contest, judge, entry } = await rubricContestWithEntry('Rubric Scoring');
    // 18/20 + 24/30 = 42/50 → 84
    const res = await judgeContestEntry(db, entry.id, undefined, judge.id, undefined, [
      { label: 'Documentation', score: 18, max: 20 },
      { label: 'Creativity', score: 24, max: 30 },
    ]);
    expect(res.judged).toBe(true);

    const { items } = await listContestEntries(db, contest.id, { includeJudgeScores: true });
    const e = items.find((i) => i.id === entry.id)!;
    expect(e.score).toBe(84);
    expect(e.judgeScores![0]!.criteriaScores).toHaveLength(2);
    expect(e.judgeScores![0]!.criteriaScores![0]).toMatchObject({ label: 'Documentation', score: 18, max: 20 });
  });

  it('rejects a criterion score above its max', async () => {
    const { judge, entry } = await rubricContestWithEntry('Rubric OOB');
    const res = await judgeContestEntry(db, entry.id, undefined, judge.id, undefined, [
      { label: 'Documentation', score: 25, max: 20 }, // 25 > 20
      { label: 'Creativity', score: 10, max: 30 },
    ]);
    expect(res.judged).toBe(false);
    expect(res.error).toMatch(/out of range/i);
  });

  it('two judges scoring the same entry concurrently both persist (no lost update)', async () => {
    const j1 = await createTestUser(db, { username: `cc-j1-${Date.now()}` });
    const j2 = await createTestUser(db, { username: `cc-j2-${Date.now()}` });
    const contest = await createContest(db, { ...makeContestInput({ title: 'Concurrent Judging' }), judges: [j1.id, j2.id] });
    await acceptJudgeInvite(db, contest.id, j1.id);
    await acceptJudgeInvite(db, contest.id, j2.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const content = await createContent(db, participantId, { type: 'project', title: 'Contended Entry' });
    await publishContent(db, content.id, participantId);
    const entry = await submitContestEntry(db, contest.id, content.id, participantId);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    // Fire both scores "at once"; the row-locked transaction must keep both.
    await Promise.all([
      judgeContestEntry(db, entry!.id, 80, j1.id),
      judgeContestEntry(db, entry!.id, 90, j2.id),
    ]);

    const { items } = await listContestEntries(db, contest.id, { includeJudgeScores: true });
    const e = items.find((i) => i.id === entry!.id)!;
    expect(e.judgeScores).toHaveLength(2); // neither write was lost
    expect(new Set(e.judgeScores!.map((s) => s.judgeId))).toEqual(new Set([j1.id, j2.id]));
    expect(e.score).toBe(85); // average of 80 and 90
  });

  // --- Judging integrity: no self-judging (session 174) ---

  it('rejects a judge scoring their own entry', async () => {
    const judgeEntrant = await createTestUser(db, { username: `selfjudge-${Date.now()}` });
    const contest = await createContest(db, { ...makeContestInput({ title: 'Self Judge Contest' }), judges: [judgeEntrant.id] });
    await acceptJudgeInvite(db, contest.id, judgeEntrant.id);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const own = await createContent(db, judgeEntrant.id, { type: 'project', title: 'Judge Own Entry' });
    await publishContent(db, own.id, judgeEntrant.id);
    const entry = await submitContestEntry(db, contest.id, own.id, judgeEntrant.id);
    await transitionContestStatus(db, contest.id, organizerId, 'judging');

    const res = await judgeContestEntry(db, entry!.id, 100, judgeEntrant.id);
    expect(res.judged).toBe(false);
    expect(res.error).toMatch(/your own entry/i);
  });

  // --- Access control: visibility + role gate + stakeholders (session 174) ---

  it('canViewContest: public/unlisted are open; private is gated', async () => {
    const outsider = await createTestUser(db, { username: `outsider-${Date.now()}` });
    const staff = await createTestUser(db, { username: `staff-${Date.now()}`, role: 'staff' });

    const pub = await createContest(db, makeContestInput({ title: 'Public Vis' })); // default public
    expect(await canViewContest(db, pub, null)).toBe(true);

    const unlisted = await createContest(db, { ...makeContestInput({ title: 'Unlisted Vis' }), visibility: 'unlisted' });
    expect(await canViewContest(db, unlisted, null)).toBe(true);

    const priv = await createContest(db, { ...makeContestInput({ title: 'Private Vis' }), visibility: 'private', visibleToRoles: ['staff'] });
    expect(priv.visibility).toBe('private');
    expect(await canViewContest(db, priv, null)).toBe(false); // anon
    expect(await canViewContest(db, priv, { id: outsider.id, role: 'member' })).toBe(false); // wrong role
    expect(await canViewContest(db, priv, { id: staff.id, role: 'staff' })).toBe(true); // role gate
    expect(await canViewContest(db, priv, { id: organizerId, role: 'member' })).toBe(true); // owner
    expect(await canViewContest(db, priv, { id: outsider.id, role: 'admin' })).toBe(true); // admin
  });

  it('canViewContest: drafts are owner-only regardless of visibility', async () => {
    const outsider = await createTestUser(db, { username: `draft-outsider-${Date.now()}` });
    // A contest with PUBLIC visibility but DRAFT status must still be hidden from
    // everyone but the owner/admin — status gates orthogonally to visibility.
    const c = await createContest(db, makeContestInput({ title: 'Draft Public' }));
    const draft = { ...c, status: 'draft' };

    expect(await canViewContest(db, draft, null)).toBe(false); // anon
    expect(await canViewContest(db, draft, { id: outsider.id, role: 'member' })).toBe(false);
    expect(await canViewContest(db, draft, { id: organizerId, role: 'member' })).toBe(true); // owner
    expect(await canViewContest(db, draft, { id: outsider.id, role: 'admin' })).toBe(true); // admin
  });

  it('listContests hides drafts from non-owners', async () => {
    const owner = await createTestUser(db, { username: `draft-owner-${Date.now()}` });
    const other = await createTestUser(db, { username: `draft-other-${Date.now()}` });
    const c = await createContest(db, { ...makeContestInput({ title: `Hidden Draft ${Date.now()}` }), createdBy: owner.id });
    await transitionContestStatus(db, c.id, owner.id, 'draft');

    const anon = await listContests(db, { limit: 200 }, null);
    expect(anon.items.find((i) => i.id === c.id)).toBeUndefined();

    const stranger = await listContests(db, { limit: 200 }, { userId: other.id, role: 'member' });
    expect(stranger.items.find((i) => i.id === c.id)).toBeUndefined();

    const mine = await listContests(db, { limit: 200 }, { userId: owner.id, role: 'member' });
    expect(mine.items.find((i) => i.id === c.id)).toBeDefined();
  });

  it('stakeholders get review access to a private contest', async () => {
    const reviewer = await createTestUser(db, { username: `reviewer-${Date.now()}` });
    const priv = await createContest(db, { ...makeContestInput({ title: 'Stakeholder Vis' }), visibility: 'private' });

    expect(await canViewContest(db, priv, { id: reviewer.id, role: 'member' })).toBe(false);
    const r = await addContestStakeholder(db, priv.id, reviewer.id);
    expect(r.added).toBe(true);
    expect(await isContestStakeholder(db, priv.id, reviewer.id)).toBe(true);
    expect(await canViewContest(db, priv, { id: reviewer.id, role: 'member' })).toBe(true);

    const list = await listContestStakeholders(db, priv.id);
    expect(list.map((s) => s.userId)).toContain(reviewer.id);

    expect(await removeContestStakeholder(db, priv.id, reviewer.id)).toBe(true);
    expect(await canViewContest(db, priv, { id: reviewer.id, role: 'member' })).toBe(false);
  });

  it('seeds stakeholders + visibility from create input', async () => {
    const reviewer = await createTestUser(db, { username: `seed-sh-${Date.now()}` });
    const contest = await createContest(db, {
      ...makeContestInput({ title: 'Seeded Access Contest' }),
      visibility: 'private',
      visibleToRoles: ['verified'],
      stakeholders: [reviewer.id],
    });
    expect(contest.visibility).toBe('private');
    expect(contest.visibleToRoles).toEqual(['verified']);
    expect(await isContestStakeholder(db, contest.id, reviewer.id)).toBe(true);
  });

  it('listContests hides non-public contests from the public list', async () => {
    const owner = await createTestUser(db, { username: `vis-owner-${Date.now()}` });
    const tag = `vislist-${Date.now()}`;
    await createContest(db, { ...makeContestInput({ title: `${tag} public` }), createdBy: owner.id });
    await createContest(db, { ...makeContestInput({ title: `${tag} unlisted` }), createdBy: owner.id, visibility: 'unlisted' });
    await createContest(db, { ...makeContestInput({ title: `${tag} private` }), createdBy: owner.id, visibility: 'private' });

    const anon = (await listContests(db, { limit: 100 })).items.filter((c) => c.title.startsWith(tag));
    expect(anon.map((c) => c.title)).toEqual([`${tag} public`]);

    // The owner sees all of their own (incl. drafts).
    const mine = (await listContests(db, { limit: 100 }, { userId: owner.id, role: 'member' })).items.filter((c) => c.title.startsWith(tag));
    expect(mine.length).toBe(3);

    // An admin sees everything.
    const asAdmin = (await listContests(db, { limit: 100 }, { userId: organizerId, role: 'admin' })).items.filter((c) => c.title.startsWith(tag));
    expect(asAdmin.length).toBe(3);
  });
});
