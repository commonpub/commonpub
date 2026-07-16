import { describe, it, expect } from 'vitest';
import { synthesizeStages, normalizeStages, currentStage, nextContestDeadline } from '../contest/index.js';
import type { ContestStage } from '@commonpub/schema';

// Pure helpers — no DB. Phase B1 stage-timeline derivation + back-compat.

const base = {
  status: 'active',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-02-01T00:00:00.000Z'),
  judgingEndDate: new Date('2026-02-15T00:00:00.000Z'),
  stages: [] as ContestStage[],
  currentStageId: null as string | null,
};

describe('synthesizeStages', () => {
  it('builds the classic Submissions → Judging → Results trio from dates', () => {
    const s = synthesizeStages(base);
    expect(s.map((x) => x.kind)).toEqual(['submission', 'review', 'results']);
    expect(s.map((x) => x.id)).toEqual(['core-submission', 'core-review', 'core-results']);
    expect(s.every((x) => x.core)).toBe(true);
    expect(s[0]!.startsAt).toBe('2026-01-01T00:00:00.000Z');
    expect(s[0]!.endsAt).toBe('2026-02-01T00:00:00.000Z');
    // Review ends at the judging deadline when set.
    expect(s[1]!.endsAt).toBe('2026-02-15T00:00:00.000Z');
  });

  it('review falls back to endDate when no judging deadline', () => {
    const s = synthesizeStages({ ...base, judgingEndDate: null });
    expect(s[1]!.endsAt).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('normalizeStages', () => {
  it('synthesizes when stages is empty (the standard flow is the default)', () => {
    expect(normalizeStages(base)).toHaveLength(3);
    expect(normalizeStages({ ...base, stages: null as unknown as ContestStage[] })).toHaveLength(3);
  });

  it('returns explicit stages verbatim when defined', () => {
    const custom: ContestStage[] = [
      { id: 'a', name: 'Proposals Open', kind: 'submission' },
      { id: 'b', name: 'Top 50 Selection', kind: 'review' },
      { id: 'c', name: 'Hardware Sprint', kind: 'interim' },
      { id: 'd', name: 'Final Judging', kind: 'review' },
      { id: 'e', name: 'Finale — D.C.', kind: 'event' },
    ];
    expect(normalizeStages({ ...base, stages: custom })).toEqual(custom);
  });
});

describe('currentStage', () => {
  it('derives from status when no currentStageId (synthesized flow)', () => {
    expect(currentStage({ ...base, status: 'upcoming' })?.kind).toBe('submission');
    expect(currentStage({ ...base, status: 'active' })?.kind).toBe('submission');
    expect(currentStage({ ...base, status: 'paused' })?.kind).toBe('submission');
    expect(currentStage({ ...base, status: 'judging' })?.kind).toBe('review');
    expect(currentStage({ ...base, status: 'completed' })?.kind).toBe('results');
    expect(currentStage({ ...base, status: 'draft' })).toBeNull();
    expect(currentStage({ ...base, status: 'cancelled' })).toBeNull();
  });

  it('honours a resolvable currentStageId over status derivation', () => {
    const stages: ContestStage[] = [
      { id: 'a', name: 'Round 1', kind: 'submission' },
      { id: 'b', name: 'Round 2', kind: 'submission' },
    ];
    // Two submission rounds: currentStageId disambiguates which is "now".
    expect(currentStage({ ...base, status: 'active', stages, currentStageId: 'b' })?.id).toBe('b');
  });

  it('falls back to status derivation when currentStageId is stale', () => {
    const stages: ContestStage[] = [
      { id: 'a', name: 'Round 1', kind: 'submission' },
      { id: 'b', name: 'Judge', kind: 'review' },
    ];
    expect(currentStage({ ...base, status: 'judging', stages, currentStageId: 'gone' })?.id).toBe('b');
  });
});

describe('nextContestDeadline', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  it('falls back to the final endDate for a classic (stage-less) contest', () => {
    const d = nextContestDeadline({ ...base, endDate: new Date('2026-08-01T00:00:00.000Z'), stages: [] }, now);
    // Synthesized submission stage carries endsAt = endDate.
    expect(d.at.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(d.stageId).toBe('core-submission');
    expect(d.isOwnDeadline).toBe(true); // keeps the historical ledger key
  });

  it('returns the EARLIEST upcoming submission/interim stage deadline (the proposal), not the final', () => {
    const stages: ContestStage[] = [
      { id: 'proposal', name: 'Proposal', kind: 'submission', endsAt: '2026-07-01T00:00:00.000Z' },
      { id: 'prototype', name: 'Prototype', kind: 'interim', endsAt: '2026-09-01T00:00:00.000Z' },
      { id: 'judge', name: 'Judging', kind: 'review', endsAt: '2026-10-01T00:00:00.000Z' },
    ];
    const d = nextContestDeadline({ ...base, endDate: new Date('2026-11-08T16:00:00.000Z'), stages }, now);
    expect(d.at.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(d.stageId).toBe('proposal');
    expect(d.isOwnDeadline).toBe(false); // an explicit stage → stage-scoped ledger key
  });

  it('marks an explicit stage id of "final" as NOT own-deadline (provenance, not the id string)', () => {
    // A user stage literally named/id'd 'final' must still get a scoped key — the
    // own-deadline flag is derived from whether explicit stages exist, not the id.
    const stages: ContestStage[] = [
      { id: 'final', name: 'Final', kind: 'submission', endsAt: '2026-07-01T00:00:00.000Z' },
    ];
    const d = nextContestDeadline({ ...base, endDate: new Date('2026-11-08T00:00:00.000Z'), stages }, now);
    expect(d.stageId).toBe('final');
    expect(d.isOwnDeadline).toBe(false); // explicit stage → scoped, no collision with the endDate fallback
  });

  it('advances to the next stage deadline once an earlier one has passed', () => {
    const stages: ContestStage[] = [
      { id: 'proposal', name: 'Proposal', kind: 'submission', endsAt: '2026-05-01T00:00:00.000Z' }, // already past `now`
      { id: 'prototype', name: 'Prototype', kind: 'submission', endsAt: '2026-09-01T00:00:00.000Z' },
    ];
    const d = nextContestDeadline({ ...base, endDate: new Date('2026-11-08T00:00:00.000Z'), stages }, now);
    expect(d.stageId).toBe('prototype');
  });

  it('ignores non-submission stages (review/results/event) when picking the deadline', () => {
    const stages: ContestStage[] = [
      { id: 'r', name: 'Judging', kind: 'review', endsAt: '2026-06-15T00:00:00.000Z' },
      { id: 's', name: 'Submit', kind: 'submission', endsAt: '2026-07-20T00:00:00.000Z' },
    ];
    const d = nextContestDeadline({ ...base, endDate: new Date('2026-08-01T00:00:00.000Z'), stages }, now);
    expect(d.stageId).toBe('s'); // not the earlier review deadline
  });

  it('falls back to endDate when all submission stages are in the past', () => {
    const stages: ContestStage[] = [
      { id: 'proposal', name: 'Proposal', kind: 'submission', endsAt: '2026-05-01T00:00:00.000Z' },
    ];
    const d = nextContestDeadline({ ...base, endDate: new Date('2026-10-01T00:00:00.000Z'), stages }, now);
    expect(d.stageId).toBe('final');
    expect(d.at.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(d.isOwnDeadline).toBe(true);
  });
});
