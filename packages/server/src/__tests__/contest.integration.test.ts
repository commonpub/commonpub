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
} from '../contest/contest.js';
import { createContent, publishContent } from '../content/content.js';

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
});
