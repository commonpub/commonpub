import { describe, it, expect } from 'vitest';
import {
  synthesizeStages,
  normalizeStages,
  currentStageId,
  seedStandardStages,
  blankStage,
  newStageId,
  withStageAdded,
  withStageDuplicated,
  withStageRemoved,
  withStageMoved,
  fieldKeyFromLabel,
  blankTemplateField,
  withTemplateFieldAdded,
  withTemplateFieldSet,
  withTemplateFieldLabelChanged,
  withTemplateFieldRemoved,
  type StageSource,
} from '../contestStages';
import type { ContestStage } from '@commonpub/schema';

const base: StageSource = {
  status: 'active',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-02-01T00:00:00.000Z',
  judgingEndDate: '2026-02-15T00:00:00.000Z',
  stages: [],
  currentStageId: null,
};

describe('synthesizeStages / normalizeStages (client mirror of the server)', () => {
  it('synthesizes the classic trio from dates', () => {
    const s = synthesizeStages(base);
    expect(s.map((x) => x.kind)).toEqual(['submission', 'review', 'results']);
    expect(s.map((x) => x.id)).toEqual(['core-submission', 'core-review', 'core-results']);
    expect(s[1]!.endsAt).toBe('2026-02-15T00:00:00.000Z'); // review → judging deadline
  });

  it('normalizeStages prefers explicit stages, else synthesizes', () => {
    expect(normalizeStages(base)).toHaveLength(3);
    const custom: ContestStage[] = [{ id: 'a', name: 'Proposals', kind: 'submission' }];
    expect(normalizeStages({ ...base, stages: custom })).toEqual(custom);
  });
});

describe('currentStageId derivation', () => {
  it('derives from status when unset', () => {
    expect(currentStageId({ ...base, status: 'upcoming' })).toBe('core-submission');
    expect(currentStageId({ ...base, status: 'judging' })).toBe('core-review');
    expect(currentStageId({ ...base, status: 'completed' })).toBe('core-results');
    expect(currentStageId({ ...base, status: 'draft' })).toBeNull();
    expect(currentStageId({ ...base, status: 'cancelled' })).toBeNull();
  });

  it('honours a resolvable currentStageId, falls back when stale', () => {
    const stages: ContestStage[] = [
      { id: 'a', name: 'R1', kind: 'submission' },
      { id: 'b', name: 'R2', kind: 'submission' },
    ];
    expect(currentStageId({ ...base, stages, currentStageId: 'b' })).toBe('b');
    expect(currentStageId({ ...base, stages, currentStageId: 'gone' })).toBe('a'); // first submission
  });
});

describe('pure stage-array operations', () => {
  it('newStageId is unique; blankStage is a custom stage', () => {
    expect(newStageId()).not.toBe(newStageId());
    const b = blankStage();
    expect(b.kind).toBe('custom');
    expect(b.name).toBe('');
    expect(b.id).toBeTruthy();
  });

  it('seedStandardStages produces 3 stages with unique ids + dates', () => {
    const s = seedStandardStages(base);
    expect(s.map((x) => x.kind)).toEqual(['submission', 'review', 'results']);
    expect(new Set(s.map((x) => x.id)).size).toBe(3); // unique ids (not the synthesized core-* ones)
    expect(s[0]!.startsAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('withStageAdded appends a blank stage immutably', () => {
    const start: ContestStage[] = [{ id: 'a', name: 'A', kind: 'submission' }];
    const next = withStageAdded(start);
    expect(next).toHaveLength(2);
    expect(start).toHaveLength(1); // original untouched
    expect(next[1]!.kind).toBe('custom');
  });

  it('withStageDuplicated inserts a copy after the source with a new id', () => {
    const start: ContestStage[] = [
      { id: 'a', name: 'A', kind: 'review', core: true },
      { id: 'b', name: 'B', kind: 'results' },
    ];
    const next = withStageDuplicated(start, 0);
    expect(next.map((s) => s.name)).toEqual(['A', 'A (copy)', 'B']);
    expect(next[1]!.id).not.toBe('a');
    expect(next[1]!.kind).toBe('review');
    expect(next[1]!.core).toBe(false); // copies are never core
  });

  it('withStageRemoved drops the stage at the index', () => {
    const start: ContestStage[] = [
      { id: 'a', name: 'A', kind: 'submission' },
      { id: 'b', name: 'B', kind: 'review' },
    ];
    expect(withStageRemoved(start, 0).map((s) => s.id)).toEqual(['b']);
  });

  it('withStageMoved swaps within bounds and no-ops at the edges', () => {
    const start: ContestStage[] = [
      { id: 'a', name: 'A', kind: 'submission' },
      { id: 'b', name: 'B', kind: 'review' },
      { id: 'c', name: 'C', kind: 'results' },
    ];
    expect(withStageMoved(start, 1, -1).map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(withStageMoved(start, 2, 1).map((s) => s.id)).toEqual(['a', 'b', 'c']); // down at last = no-op
    expect(withStageMoved(start, 0, -1).map((s) => s.id)).toEqual(['a', 'b', 'c']); // up at first = no-op
  });
});

describe('submission-template field operations', () => {
  const stage = (template?: ReturnType<typeof blankTemplateField>[]): ContestStage => ({
    id: 's1', name: 'Proposals', kind: 'submission', submissionTemplate: template,
  });

  it('fieldKeyFromLabel slugs to ^[a-z0-9_]+$ with a fallback', () => {
    expect(fieldKeyFromLabel('Repository URL')).toBe('repository_url');
    expect(fieldKeyFromLabel('  Demo — video!  ')).toBe('demo_video');
    expect(fieldKeyFromLabel('???')).toBe('field');
    expect(fieldKeyFromLabel('x'.repeat(60))).toHaveLength(40);
  });

  it('withTemplateFieldAdded appends a blank field immutably', () => {
    const start = [stage()];
    const next = withTemplateFieldAdded(start, 0);
    expect(next[0]!.submissionTemplate).toHaveLength(1);
    expect(start[0]!.submissionTemplate).toBeUndefined(); // original untouched
  });

  it('withTemplateFieldSet patches one field', () => {
    const start = [stage([{ key: 'summary', label: 'Summary', type: 'text', required: false }])];
    const next = withTemplateFieldSet(start, 0, 0, { required: true, type: 'textarea' });
    expect(next[0]!.submissionTemplate![0]).toEqual({ key: 'summary', label: 'Summary', type: 'textarea', required: true });
  });

  it('label changes re-derive the key only while it tracks the label', () => {
    const start = [stage([{ key: 'summary', label: 'Summary', type: 'text', required: false }])];
    // Key tracks the label → re-derived.
    const auto = withTemplateFieldLabelChanged(start, 0, 0, 'Project summary');
    expect(auto[0]!.submissionTemplate![0]!.key).toBe('project_summary');
    // Hand-edited key → stable across label edits (artifact values hang off it).
    const pinned = withTemplateFieldSet(start, 0, 0, { key: 'custom_key' });
    const after = withTemplateFieldLabelChanged(pinned, 0, 0, 'Renamed');
    expect(after[0]!.submissionTemplate![0]!.key).toBe('custom_key');
    expect(after[0]!.submissionTemplate![0]!.label).toBe('Renamed');
  });

  it('withTemplateFieldRemoved drops the field; removing the last clears the template', () => {
    const start = [stage([
      { key: 'a', label: 'A', type: 'text', required: false },
      { key: 'b', label: 'B', type: 'url', required: true },
    ])];
    const one = withTemplateFieldRemoved(start, 0, 0);
    expect(one[0]!.submissionTemplate!.map((f) => f.key)).toEqual(['b']);
    const none = withTemplateFieldRemoved(one, 0, 0);
    expect(none[0]!.submissionTemplate).toBeUndefined();
  });
});
