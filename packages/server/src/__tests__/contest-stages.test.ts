import { describe, it, expect } from 'vitest';
import { synthesizeStages, normalizeStages, currentStage } from '../contest/index.js';
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
