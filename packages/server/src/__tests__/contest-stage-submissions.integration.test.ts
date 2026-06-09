import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContest,
  submitContestEntry,
  transitionContestStatus,
  judgeContestEntry,
  advanceContestStage,
  listContestEntries,
  getContestEntry,
  submitStageArtifact,
  validateStageArtifactFields,
} from '../contest/contest.js';
import { addContestJudge, acceptJudgeInvite } from '../contest/judges.js';
import { createContent, publishContent } from '../content/content.js';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';

const PROPOSAL_TEMPLATE: ContestSubmissionTemplateField[] = [
  { key: 'summary', label: 'Summary', type: 'textarea', required: true },
  { key: 'focus_area', label: 'Focus area', type: 'text', required: true },
  { key: 'approach', label: 'Approach', type: 'textarea', required: false },
];

const PROTOTYPE_TEMPLATE: ContestSubmissionTemplateField[] = [
  { key: 'repo_url', label: 'Repository URL', type: 'url', required: true },
  { key: 'demo_url', label: 'Demo video URL', type: 'url', required: false },
];

describe('contest per-stage submissions', () => {
  let db: DB;
  let organizerId: string;
  let judgeUserId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'sub-organizer' })).id;
    judgeUserId = (await createTestUser(db, { username: 'sub-judge' })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  function stagedContestInput(slugHint: string) {
    return {
      title: `Per-stage ${slugHint}`,
      slug: `per-stage-${slugHint}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-08-01').toISOString(),
      createdBy: organizerId,
      stages: [
        { id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionTemplate: PROPOSAL_TEMPLATE },
        { id: 'rev1', name: 'Screening', kind: 'review' as const },
        { id: 'proto', name: 'Prototype', kind: 'submission' as const, submissionTemplate: PROTOTYPE_TEMPLATE },
        { id: 'rev2', name: 'Final Judging', kind: 'review' as const },
      ],
      currentStageId: 'prop',
    };
  }

  async function makeEntry(contestId: string, username: string) {
    const user = await createTestUser(db, { username: `${username}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
    const content = await createContent(db, user.id, { type: 'project', title: `${username} project` });
    await publishContent(db, content.id, user.id);
    const entry = await submitContestEntry(db, contestId, content.id, user.id);
    return { userId: user.id, entryId: entry!.id };
  }

  describe('validateStageArtifactFields (pure)', () => {
    it('accepts a filled template and rejects missing/blank required fields', () => {
      const ok = validateStageArtifactFields(PROPOSAL_TEMPLATE, { summary: 'A plan', focus_area: 'water' });
      expect(ok.ok).toBe(true);

      const missing = validateStageArtifactFields(PROPOSAL_TEMPLATE, { focus_area: 'water' });
      expect(missing.ok).toBe(false);

      // Whitespace-only does not satisfy a required field.
      const blank = validateStageArtifactFields(PROPOSAL_TEMPLATE, { summary: '   ', focus_area: 'water' });
      expect(blank.ok).toBe(false);
    });

    it('rejects unknown keys (no smuggling values outside the template)', () => {
      const res = validateStageArtifactFields(PROPOSAL_TEMPLATE, {
        summary: 'A plan', focus_area: 'water', extra: 'nope',
      });
      expect(res.ok).toBe(false);
    });

    it('enforces https?:// on url fields (javascript: and bare strings rejected)', () => {
      // Known-bad payloads MUST be red (regex empty-alternation class of bug).
      for (const bad of ['javascript:alert(1)', 'ftp://x.com/repo', 'not a url', 'https://']) {
        const res = validateStageArtifactFields(PROTOTYPE_TEMPLATE, { repo_url: bad });
        expect(res.ok, `should reject ${bad}`).toBe(false);
      }
      expect(validateStageArtifactFields(PROTOTYPE_TEMPLATE, { repo_url: 'https://github.com/x/y' }).ok).toBe(true);
      expect(validateStageArtifactFields(PROTOTYPE_TEMPLATE, { repo_url: 'http://example.com/demo' }).ok).toBe(true);
    });

    it('an optional url field may be omitted or empty, but not malformed', () => {
      expect(validateStageArtifactFields(PROTOTYPE_TEMPLATE, { repo_url: 'https://github.com/x/y', demo_url: '' }).ok).toBe(true);
      expect(validateStageArtifactFields(PROTOTYPE_TEMPLATE, { repo_url: 'https://github.com/x/y', demo_url: 'javascript:x' }).ok).toBe(false);
    });

    it('caps field value length at 4000', () => {
      const res = validateStageArtifactFields(PROPOSAL_TEMPLATE, { summary: 'x'.repeat(4001), focus_area: 'water' });
      expect(res.ok).toBe(false);
    });
  });

  describe('submitStageArtifact', () => {
    it('submits a proposal artifact and re-submit replaces it while the stage is open', async () => {
      const contest = await createContest(db, stagedContestInput('happy'));
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const { userId, entryId } = await makeEntry(contest.id, 'happy');

      const first = await submitStageArtifact(db, entryId, 'prop', { summary: 'v1 plan', focus_area: 'water' }, userId);
      expect(first.submitted).toBe(true);
      expect(first.stageSubmissions).toHaveLength(1);
      expect(first.stageSubmissions![0]!.stageId).toBe('prop');
      expect(first.stageSubmissions![0]!.fields).toEqual({ summary: 'v1 plan', focus_area: 'water' });
      expect(new Date(first.stageSubmissions![0]!.submittedAt).getTime()).not.toBeNaN();

      // Upsert: same stage replaces, doesn't append.
      const second = await submitStageArtifact(db, entryId, 'prop', { summary: 'v2 plan', focus_area: 'shelter', approach: 'mesh' }, userId);
      expect(second.submitted).toBe(true);
      expect(second.stageSubmissions).toHaveLength(1);
      expect(second.stageSubmissions![0]!.fields.summary).toBe('v2 plan');
      expect(second.stageSubmissions![0]!.fields.approach).toBe('mesh');
    });

    it('rejects a non-owner, an unknown stage, a non-submission stage, and a stage that is not current', async () => {
      const contest = await createContest(db, stagedContestInput('gates'));
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const { userId, entryId } = await makeEntry(contest.id, 'gates');
      const stranger = await createTestUser(db, { username: `stranger-${Date.now()}` });

      expect((await submitStageArtifact(db, entryId, 'prop', { summary: 's', focus_area: 'f' }, stranger.id)).submitted).toBe(false);
      expect((await submitStageArtifact(db, entryId, 'nope', { summary: 's', focus_area: 'f' }, userId)).submitted).toBe(false);
      expect((await submitStageArtifact(db, entryId, 'rev1', { summary: 's', focus_area: 'f' }, userId)).submitted).toBe(false);
      // 'proto' exists and is a submission stage, but the contest is on 'prop'.
      expect((await submitStageArtifact(db, entryId, 'proto', { repo_url: 'https://github.com/x/y' }, userId)).submitted).toBe(false);
    });

    it('rejects template validation failures with a specific error', async () => {
      const contest = await createContest(db, stagedContestInput('invalid'));
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const { userId, entryId } = await makeEntry(contest.id, 'invalid');

      const missing = await submitStageArtifact(db, entryId, 'prop', { focus_area: 'water' }, userId);
      expect(missing.submitted).toBe(false);
      expect(missing.error).toMatch(/Summary/);
    });

    it('rejects while the contest is not active (judging/paused/draft)', async () => {
      const contest = await createContest(db, stagedContestInput('inactive'));
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const { userId, entryId } = await makeEntry(contest.id, 'inactive');
      await transitionContestStatus(db, contest.id, organizerId, 'judging');

      const res = await submitStageArtifact(db, entryId, 'prop', { summary: 's', focus_area: 'f' }, userId);
      expect(res.submitted).toBe(false);
    });

    it('cohort gate: an eliminated entry cannot submit the later-stage artifact; an advanced one can', async () => {
      const contest = await createContest(db, stagedContestInput('cohort'));
      await addContestJudge(db, contest.id, judgeUserId, 'judge');
      await acceptJudgeInvite(db, contest.id, judgeUserId);
      await transitionContestStatus(db, contest.id, organizerId, 'active');

      // Low scorer submitted FIRST so an insertion-order cull would pass the
      // wrong entry (same adversarial setup as the advancement tests).
      const loser = await makeEntry(contest.id, 'cohort-loser');
      const winner = await makeEntry(contest.id, 'cohort-winner');
      await submitStageArtifact(db, loser.entryId, 'prop', { summary: 'weak', focus_area: 'x' }, loser.userId);
      await submitStageArtifact(db, winner.entryId, 'prop', { summary: 'strong', focus_area: 'y' }, winner.userId);

      await transitionContestStatus(db, contest.id, organizerId, 'judging');
      await judgeContestEntry(db, loser.entryId, 30, judgeUserId);
      await judgeContestEntry(db, winner.entryId, 95, judgeUserId);

      // Screening cut: top 1 advances; currentStageId moves to 'proto'.
      const cut = await advanceContestStage(db, contest.id, organizerId, { reviewStageId: 'rev1', mode: 'topN', topN: 1 });
      expect(cut.advanced).toBe(true);
      // Back to active for the prototype submission round (kind → status mapping).
      await transitionContestStatus(db, contest.id, organizerId, 'active');

      const denied = await submitStageArtifact(db, loser.entryId, 'proto', { repo_url: 'https://github.com/l/x' }, loser.userId);
      expect(denied.submitted).toBe(false);
      expect(denied.error).toMatch(/not advanced/i);

      const allowed = await submitStageArtifact(db, winner.entryId, 'proto', { repo_url: 'https://github.com/w/y' }, winner.userId);
      expect(allowed.submitted).toBe(true);
      // Both artifacts now on the entry — proposal AND prototype.
      expect(allowed.stageSubmissions!.map((s) => s.stageId).sort()).toEqual(['prop', 'proto']);
    });

    it('rejects a submission stage with no template', async () => {
      const input = stagedContestInput('notemplate');
      input.stages[0] = { id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionTemplate: PROPOSAL_TEMPLATE };
      input.stages[0] = { ...input.stages[0], submissionTemplate: undefined } as never;
      const contest = await createContest(db, input);
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const { userId, entryId } = await makeEntry(contest.id, 'notemplate');

      const res = await submitStageArtifact(db, entryId, 'prop', { summary: 's' }, userId);
      expect(res.submitted).toBe(false);
    });
  });

  describe('visibility plumbing', () => {
    it('listContestEntries exposes stageSubmissions only when privileged or own', async () => {
      const contest = await createContest(db, stagedContestInput('vis'));
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const a = await makeEntry(contest.id, 'vis-a');
      const b = await makeEntry(contest.id, 'vis-b');
      await submitStageArtifact(db, a.entryId, 'prop', { summary: 'a plan', focus_area: 'a' }, a.userId);
      await submitStageArtifact(db, b.entryId, 'prop', { summary: 'b plan', focus_area: 'b' }, b.userId);

      // Default (public viewer): no artifacts at all.
      const pub = await listContestEntries(db, contest.id);
      expect(pub.items.every((i) => i.stageSubmissions === undefined)).toBe(true);

      // Privileged: every entry's artifacts.
      const priv = await listContestEntries(db, contest.id, { includeStageSubmissions: true });
      expect(priv.items.every((i) => Array.isArray(i.stageSubmissions) && i.stageSubmissions.length === 1)).toBe(true);

      // Entrant: only their own.
      const own = await listContestEntries(db, contest.id, { stageSubmissionsViewerId: a.userId });
      const mine = own.items.find((i) => i.id === a.entryId)!;
      const theirs = own.items.find((i) => i.id === b.entryId)!;
      expect(mine.stageSubmissions).toHaveLength(1);
      expect(theirs.stageSubmissions).toBeUndefined();
    });

    it('revealScores:false also nulls the per-round snapshot scores in stageState (leak guard)', async () => {
      const contest = await createContest(db, stagedContestInput('snapleak'));
      await addContestJudge(db, contest.id, judgeUserId, 'judge');
      await acceptJudgeInvite(db, contest.id, judgeUserId);
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const a = await makeEntry(contest.id, 'snapleak-a');
      const b = await makeEntry(contest.id, 'snapleak-b');
      await transitionContestStatus(db, contest.id, organizerId, 'judging');
      await judgeContestEntry(db, a.entryId, 80, judgeUserId);
      await judgeContestEntry(db, b.entryId, 60, judgeUserId);
      // The advancement cut snapshots each entry's round score into stageState.
      await advanceContestStage(db, contest.id, organizerId, { reviewStageId: 'rev1', mode: 'topN', topN: 1 });

      // Public view of a judges-only contest mid-flow: NO score anywhere —
      // not the live aggregate, and not the per-round snapshot.
      const masked = await listContestEntries(db, contest.id, { revealScores: false });
      for (const item of masked.items) {
        expect(item.score).toBeNull();
        for (const s of item.stageState) expect(s.score ?? null).toBeNull();
      }
      // The cohort outcome itself stays public.
      expect(masked.items.some((i) => i.eliminated)).toBe(true);

      // Privileged view keeps the snapshots.
      const revealed = await listContestEntries(db, contest.id, { revealScores: true });
      const winner = revealed.items.find((i) => i.id === a.entryId)!;
      expect(winner.stageState[0]!.score).toBe(80);
    });

    it('getContestEntry returns the enriched entry with artifacts + judge scores', async () => {
      const contest = await createContest(db, stagedContestInput('detail'));
      await transitionContestStatus(db, contest.id, organizerId, 'active');
      const { userId, entryId } = await makeEntry(contest.id, 'detail');
      await submitStageArtifact(db, entryId, 'prop', { summary: 'detail plan', focus_area: 'd' }, userId);

      const entry = await getContestEntry(db, entryId);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(entryId);
      expect(entry!.contestId).toBe(contest.id);
      expect(entry!.contentTitle).toContain('detail');
      expect(entry!.stageSubmissions).toHaveLength(1);
      expect(entry!.stageSubmissions![0]!.fields.summary).toBe('detail plan');
      expect(Array.isArray(entry!.judgeScores)).toBe(true);

      expect(await getContestEntry(db, crypto.randomUUID())).toBeNull();
    });
  });
});
