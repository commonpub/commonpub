/**
 * Session 260 — judging hardening, found auditing the deveco contest the night
 * before its first review round. Each test pins one failure that the earlier
 * suite let through:
 *
 * - a re-run cut could only shrink the field, never reinstate (the panel said
 *   "You can re-run this");
 * - a cut could run outside judging or on a stage that isn't current, and moving
 *   the stage pointer could go BACKWARDS;
 * - the cut ranked on the live `score`, which is stale for anyone not re-scored
 *   in the round, instead of the round's own scores;
 * - scoring while the current stage is not a review round saved untagged scores
 *   that blended rounds;
 * - an entry could be attached outside a submission stage, or after the stage's
 *   deadline, and a proposal edited after its deadline;
 * - a removed judge's scores kept deciding the cut;
 * - `order=rank` sorted by the hidden live score.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContest,
  getContestBySlug,
  updateContest,
  submitContestEntry,
  judgeContestEntry,
  transitionContestStatus,
  listContestEntries,
  withdrawContestEntry,
  advanceContestStage,
} from '../contest/index.js';
import { submitStageArtifact } from '../contest/submissions.js';
import { createContent, publishContent } from '../content/content.js';
import { addContestJudge, acceptJudgeInvite, removeContestJudge } from '../contest/judges.js';

const DAY = 864e5;
const iso = (ms: number): string => new Date(ms).toISOString();
const uniq = (p: string): string => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

describe('contest judging hardening (session 260)', () => {
  let db: DB;
  let organizerId: string;
  let judgeA: string;
  let judgeB: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: uniq('org') })).id;
    judgeA = (await createTestUser(db, { username: uniq('ja') })).id;
    judgeB = (await createTestUser(db, { username: uniq('jb') })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  /**
   * The deveco shape: submission → review → interim → review → results, with
   * NO currentStageId (so the status drives "now"), two accepted judges.
   */
  async function staged(opts: { subEndsAt?: number } = {}) {
    const now = Date.now();
    const contest = await createContest(db, {
      title: uniq('Hardening'),
      slug: uniq('hardening'),
      description: 'x',
      startDate: iso(now - 30 * DAY),
      endDate: iso(now + 90 * DAY),
      createdBy: organizerId,
      stages: [
        { id: 'sub', name: 'Proposals', kind: 'submission', endsAt: iso(opts.subEndsAt ?? now + 5 * DAY),
          submissionTemplate: [{ key: 'pitch', label: 'Pitch', type: 'text', required: true }] },
        { id: 'r1', name: 'Semi-finals', kind: 'review' },
        { id: 'sprint', name: 'Build Sprint', kind: 'interim' },
        { id: 'r2', name: 'Finals', kind: 'review' },
        { id: 'res', name: 'Results', kind: 'results' },
      ],
    });
    for (const j of [judgeA, judgeB]) {
      await addContestJudge(db, contest.id, j, 'judge');
      await acceptJudgeInvite(db, contest.id, j);
    }
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    return contest;
  }

  async function enter(contestId: string, title: string): Promise<{ id: string; userId: string }> {
    const u = await createTestUser(db, { username: uniq(title) });
    const c = await createContent(db, u.id, { type: 'project', title });
    await publishContent(db, c.id, u.id);
    const e = await submitContestEntry(db, contestId, c.id, u.id);
    if (!e) throw new Error(`entry ${title} refused`);
    return { id: e.id, userId: u.id };
  }

  async function byId(contestId: string) {
    const items = (await listContestEntries(db, contestId, { limit: 100, includeJudgeScores: true })).items;
    return Object.fromEntries(items.map((e) => [e.id, e]));
  }

  it('a re-run cut reinstates entries a mistaken cut eliminated', async () => {
    const c = await staged();
    const es = [];
    for (let i = 0; i < 4; i++) es.push(await enter(c.id, `e${i}`));
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    for (const [i, e] of es.entries()) await judgeContestEntry(db, e.id, 90 - i * 10, judgeA);

    // Mistake: top 1. Then the intended cut: top 3.
    expect((await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 1 })).advancedCount).toBe(1);
    const rerun = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 3 });
    expect(rerun.advanced).toBe(true);
    expect(rerun.advancedCount).toBe(3);
    expect(rerun.eliminatedCount).toBe(1);
    const after = await byId(c.id);
    expect(es.map((e) => after[e.id]!.eliminated)).toEqual([false, false, false, true]);
    // The re-run did not move the stage pointer a second time.
    expect((await getContestBySlug(db, c.slug))!.currentStageId).toBe('sprint');
  });

  it('refuses a cut outside judging, on a stage not yet reached, and an empty manual pick', async () => {
    const c = await staged();
    await enter(c.id, 'solo');
    const early = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 50 });
    expect(early.advanced).toBe(false);
    expect(early.error).toMatch(/judging/i);
    expect((await getContestBySlug(db, c.slug))!.currentStageId).toBeNull();

    await transitionContestStatus(db, c.id, organizerId, 'judging');
    const future = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r2', mode: 'topN', topN: 10 });
    expect(future.advanced).toBe(false);
    expect(future.error).toMatch(/current/i);

    const empty = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'manual', advancedEntryIds: [] });
    expect(empty.advanced).toBe(false);
    expect(empty.error).toMatch(/pick at least one/i);
    // Ids that match nobody would otherwise eliminate the whole field.
    const ghost = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'manual', advancedEntryIds: ['00000000-0000-0000-0000-000000000000'] });
    expect(ghost.advanced).toBe(false);
    expect(ghost.error).toMatch(/none of the picked/i);
    const zero = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 0 });
    expect(zero.advanced).toBe(false);
    expect(zero.error).toMatch(/at least one/i);
    expect((await byId(c.id))[Object.keys(await byId(c.id))[0]!]!.eliminated).toBe(false);
  });

  it('re-running an earlier cut never moves the stage pointer backwards, and is refused once a later round has scores', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    const b = await enter(c.id, 'b');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 80, judgeA);
    await judgeContestEntry(db, b.id, 60, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 2 });
    await updateContest(db, c.slug, organizerId, { currentStageId: 'r2' });

    // Nothing scored in r2 yet: re-running r1 is still allowed, but stays on r2.
    expect((await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 2 })).advanced).toBe(true);
    expect((await getContestBySlug(db, c.slug))!.currentStageId).toBe('r2');

    // Once r2 has a score, r1 is closed for re-runs.
    await judgeContestEntry(db, a.id, 70, judgeA);
    const late = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 1 });
    expect(late.advanced).toBe(false);
  });

  it('cuts on the round’s own scores, not a stale live score from an earlier round', async () => {
    const c = await staged();
    const [x, y, z] = [await enter(c.id, 'x'), await enter(c.id, 'y'), await enter(c.id, 'z')];
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    // Round 1: x is the clear leader.
    await judgeContestEntry(db, x.id, 95, judgeA);
    await judgeContestEntry(db, y.id, 60, judgeA);
    await judgeContestEntry(db, z.id, 50, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 3 });
    await updateContest(db, c.slug, organizerId, { currentStageId: 'r2' });

    // Round 2: y and z are scored, x is never re-scored.
    await judgeContestEntry(db, y.id, 70, judgeA);
    await judgeContestEntry(db, z.id, 65, judgeA);
    const cut = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r2', mode: 'topN', topN: 2 });
    expect(cut.advancedCount).toBe(2);
    const after = await byId(c.id);
    // x's 95 was round 1's. Unscored in round 2, it ranks last and is cut.
    expect(after[x.id]!.eliminated).toBe(true);
    expect(after[y.id]!.eliminated).toBe(false);
    expect(after[z.id]!.eliminated).toBe(false);
    // The snapshot records the round's own average.
    expect(after[y.id]!.stageState.find((s) => s.stageId === 'r2')!.score).toBe(70);
  });

  it('refuses to score while the current stage is not a review round', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 80, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 1 });
    // Now on the Build Sprint (interim), still status=judging.
    const res = await judgeContestEntry(db, a.id, 40, judgeA);
    expect(res.judged).toBe(false);
    expect(res.error).toMatch(/review/i);
    const after = await byId(c.id);
    expect(after[a.id]!.judgeScores!.every((s) => s.roundId === 'r1')).toBe(true);
  });

  it('refuses attaching an entry outside a submission stage or after its deadline', async () => {
    const c = await staged({ subEndsAt: Date.now() - DAY }); // proposals closed yesterday
    const u = await createTestUser(db, { username: uniq('late') });
    const content = await createContent(db, u.id, { type: 'project', title: 'late' });
    await publishContent(db, content.id, u.id);
    expect(await submitContestEntry(db, c.id, content.id, u.id)).toBeNull();

    const open = await staged();
    await enter(open.id, 'ontime');
    await transitionContestStatus(db, open.id, organizerId, 'judging');
    // Back to active with the review round current: still not a submission stage.
    await updateContest(db, open.slug, organizerId, { currentStageId: 'r1' });
    await transitionContestStatus(db, open.id, organizerId, 'active');
    const u2 = await createTestUser(db, { username: uniq('sneak') });
    const c2 = await createContent(db, u2.id, { type: 'project', title: 'sneak' });
    await publishContent(db, c2.id, u2.id);
    expect(await submitContestEntry(db, open.id, c2.id, u2.id)).toBeNull();
  });

  it('refuses a stage submission edit after the stage deadline', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    expect((await submitStageArtifact(db, a.id, 'sub', { pitch: 'v1' }, a.userId)).submitted).toBe(true);
    const stages = (await getContestBySlug(db, c.slug))!.stages.map((s) =>
      s.id === 'sub' ? { ...s, endsAt: iso(Date.now() - 60_000) } : s,
    );
    await updateContest(db, c.slug, organizerId, { stages });
    const late = await submitStageArtifact(db, a.id, 'sub', { pitch: 'v2 after the deadline' }, a.userId);
    expect(late.submitted).toBe(false);
    expect(late.error).toMatch(/closed/i);
  });

  it('an eliminated entry cannot be withdrawn (and so cannot re-enter fresh)', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    const b = await enter(c.id, 'b');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 80, judgeA);
    await judgeContestEntry(db, b.id, 20, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 1 });
    await transitionContestStatus(db, c.id, organizerId, 'active');
    expect((await withdrawContestEntry(db, b.id, b.userId)).withdrawn).toBe(false);
  });

  it('removing a judge drops their scores from the current round', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 90, judgeA);
    await judgeContestEntry(db, a.id, 10, judgeB);
    expect((await byId(c.id))[a.id]!.score).toBe(50);
    await removeContestJudge(db, c.id, judgeB);
    const after = (await byId(c.id))[a.id]!;
    expect(after.score).toBe(90);
    expect(after.judgeScores!.some((s) => s.judgeId === judgeB)).toBe(false);
  });

  it('a pointer moved back by hand does not reopen an earlier cut once a later round has scores', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    const b = await enter(c.id, 'b');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 80, judgeA);
    await judgeContestEntry(db, b.id, 60, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 2 });
    await updateContest(db, c.slug, organizerId, { currentStageId: 'r2' });
    await judgeContestEntry(db, a.id, 70, judgeA);
    // The organizer points back at r1 "to look", then presses Advance there.
    await updateContest(db, c.slug, organizerId, { currentStageId: 'r1' });
    const res = await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 1 });
    expect(res.advanced).toBe(false);
    expect(res.error).toMatch(/later round/i);
    // The finals score survived.
    expect((await byId(c.id))[a.id]!.judgeScores!.some((s) => s.roundId === 'r2' && s.score === 70)).toBe(true);
  });

  it('a removed judge cannot score', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await removeContestJudge(db, c.id, judgeB);
    const r = await judgeContestEntry(db, a.id, 99, judgeB);
    expect(r.judged).toBe(false);
  });

  it('completing right after a cut, with later rounds skipped, still ranks the survivors', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    const b = await enter(c.id, 'b');
    const d = await enter(c.id, 'd');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 90, judgeA);
    await judgeContestEntry(db, b.id, 70, judgeA);
    await judgeContestEntry(db, d.id, 50, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 2 });
    await transitionContestStatus(db, c.id, organizerId, 'completed');
    const after = await byId(c.id);
    expect(after[a.id]!.rank).toBe(1);
    expect(after[b.id]!.rank).toBe(2);
    expect(after[d.id]!.rank).toBeNull();
  });

  it('a finalist nobody scored in the final round stays unranked when others were scored', async () => {
    const c = await staged();
    const a = await enter(c.id, 'a');
    const b = await enter(c.id, 'b');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    await judgeContestEntry(db, a.id, 50, judgeA);
    await judgeContestEntry(db, b.id, 95, judgeA);
    await advanceContestStage(db, c.id, organizerId, { reviewStageId: 'r1', mode: 'topN', topN: 2 });
    await updateContest(db, c.slug, organizerId, { currentStageId: 'r2' });
    await judgeContestEntry(db, a.id, 60, judgeA); // b (95 in round 1) is never scored in round 2
    await transitionContestStatus(db, c.id, organizerId, 'completed');
    const after = await byId(c.id);
    expect(after[a.id]!.rank).toBe(1);
    expect(after[b.id]!.rank).toBeNull();
  });

  it('Start Judging moves an explicit submission-stage pointer to the next review round', async () => {
    const c = await staged();
    await updateContest(db, c.slug, organizerId, { currentStageId: 'sub' });
    const a = await enter(c.id, 'a');
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    expect((await getContestBySlug(db, c.slug))!.currentStageId).toBe('r1');
    expect((await judgeContestEntry(db, a.id, 70, judgeA)).judged).toBe(true);
    // A null pointer is left alone (it already resolves to the first review round).
    const d = await staged();
    await transitionContestStatus(db, d.id, organizerId, 'judging');
    expect((await getContestBySlug(db, d.slug))!.currentStageId).toBeNull();
  });

  it('rank order does not follow hidden scores', async () => {
    const c = await staged();
    const es = [];
    for (let i = 0; i < 3; i++) es.push(await enter(c.id, `o${i}`));
    await transitionContestStatus(db, c.id, organizerId, 'judging');
    // The OLDEST entry scores highest, so score order and newest-first differ.
    for (const [i, e] of es.entries()) await judgeContestEntry(db, e.id, 90 - i * 30, judgeA);
    const recent = (await listContestEntries(db, c.id, { orderBy: 'recent', limit: 10 })).items.map((e) => e.id);
    const shown = (await listContestEntries(db, c.id, { orderBy: 'rank', revealScores: true, limit: 10 })).items.map((e) => e.id);
    const hidden = (await listContestEntries(db, c.id, { orderBy: 'rank', revealScores: false, limit: 10 })).items.map((e) => e.id);
    expect(shown).toEqual([es[0]!.id, es[1]!.id, es[2]!.id]);
    expect(recent).toEqual([es[2]!.id, es[1]!.id, es[0]!.id]);
    expect(hidden).toEqual(recent);
  });
});
