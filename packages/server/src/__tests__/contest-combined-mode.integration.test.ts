import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { contestEntries } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContest, transitionContestStatus } from '../contest/contest.js';
import { registerForContest } from '../contest/registrations.js';

// P5 COMBINED mode: registering also creates a DRAFT placeholder entry (operator
// decision), only for combined + active + a proposal-mode current stage; upcoming
// defers to a launch backfill; light does nothing; idempotent + maxEntries-guarded.

const cfg = { features: {}, instance: { domain: 'test.example', name: 'Test' } } as unknown as CommonPubConfig;

describe('contest combined registration mode', () => {
  let db: DB;
  let organizerId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'cm-org' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  function input(slugHint: string, over: { mode?: 'light' | 'combined'; status?: string; proposal?: boolean } = {}) {
    return {
      title: 'Combined Contest',
      slug: `cm-${slugHint}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-12-01').toISOString(),
      createdBy: organizerId,
      registrationMode: over.mode ?? 'combined',
      stages: [
        { id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionMode: (over.proposal === false ? 'attach' : 'proposal') as 'proposal' | 'attach' },
        { id: 'judge', name: 'Judging', kind: 'review' as const },
      ],
      currentStageId: 'prop',
    };
  }

  const entriesFor = (contestId: string, userId: string) =>
    db.select().from(contestEntries).where(and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)));

  it('combined + active + proposal stage: register creates a DRAFT placeholder entry', async () => {
    const u = (await createTestUser(db, { username: `cm-u1-${Date.now()}` })).id;
    const c = await createContest(db, input('active'));
    await transitionContestStatus(db, c.id, organizerId, 'active', true);
    const res = await registerForContest(db, cfg, { contestId: c.id, userId: u });
    expect(res.registered).toBe(true);
    const entries = await entriesFor(c.id, u);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.placeholder).toBe(true);
    expect(entries[0]!.contentId).toBeTruthy();
  });

  it('light mode: register creates NO entry', async () => {
    const u = (await createTestUser(db, { username: `cm-u2-${Date.now()}` })).id;
    const c = await createContest(db, input('light', { mode: 'light' }));
    await transitionContestStatus(db, c.id, organizerId, 'active', true);
    await registerForContest(db, cfg, { contestId: c.id, userId: u });
    expect(await entriesFor(c.id, u)).toHaveLength(0);
  });

  it('combined but UPCOMING: register defers (no entry yet)', async () => {
    const u = (await createTestUser(db, { username: `cm-u3-${Date.now()}` })).id;
    const c = await createContest(db, input('upcoming')); // stays 'upcoming'
    await registerForContest(db, cfg, { contestId: c.id, userId: u });
    expect(await entriesFor(c.id, u)).toHaveLength(0);
  });

  it('combined re-register does NOT create a second entry (idempotent)', async () => {
    const u = (await createTestUser(db, { username: `cm-u4-${Date.now()}` })).id;
    const c = await createContest(db, input('reg'));
    await transitionContestStatus(db, c.id, organizerId, 'active', true);
    await registerForContest(db, cfg, { contestId: c.id, userId: u });
    await registerForContest(db, cfg, { contestId: c.id, userId: u, fields: {} });
    expect(await entriesFor(c.id, u)).toHaveLength(1);
  });

  it('combined + attach stage (not proposal): no entry created', async () => {
    const u = (await createTestUser(db, { username: `cm-u5-${Date.now()}` })).id;
    const c = await createContest(db, input('attach', { proposal: false }));
    await transitionContestStatus(db, c.id, organizerId, 'active', true);
    await registerForContest(db, cfg, { contestId: c.id, userId: u });
    expect(await entriesFor(c.id, u)).toHaveLength(0);
  });

  it('launch backfill: upcoming combined registrants get entries when the contest goes active', async () => {
    const u1 = (await createTestUser(db, { username: `cm-b1-${Date.now()}` })).id;
    const u2 = (await createTestUser(db, { username: `cm-b2-${Date.now()}` })).id;
    const c = await createContest(db, input('backfill'));
    await registerForContest(db, cfg, { contestId: c.id, userId: u1 });
    await registerForContest(db, cfg, { contestId: c.id, userId: u2 });
    expect(await entriesFor(c.id, u1)).toHaveLength(0); // deferred while upcoming

    await transitionContestStatus(db, c.id, organizerId, 'active', true); // triggers backfill
    expect(await entriesFor(c.id, u1)).toHaveLength(1);
    expect(await entriesFor(c.id, u2)).toHaveLength(1);
  });
});
