/**
 * Unit tests for the new-contest starter template. The strongest guarantee here is
 * that every seeded stage validates against the REAL server Zod schema
 * (contestStageSchema) — so a freshly-seeded contest actually saves, end to end.
 */
import { describe, it, expect } from 'vitest';
import { contestStageSchema } from '@commonpub/schema';
import { standardContestTemplate } from '../contestTemplates';

describe('standardContestTemplate', () => {
  it('seeds a Proposals → Judging → Results timeline with a default rubric', () => {
    const t = standardContestTemplate({ proposals: true, pii: true });
    expect(t.stages.map((s) => s.kind)).toEqual(['submission', 'review', 'results']);
    expect(t.judgingCriteria.map((c) => c.label)).toEqual(['Innovation', 'Feasibility', 'Impact']);
    expect(t.judgingCriteria.reduce((sum, c) => sum + (c.weight ?? 0), 0)).toBe(100);
    expect(t.currentStageId).toBeNull();
    expect(t.descriptionBlocks.length).toBeGreaterThan(0);
    expect(t.rulesBlocks.length).toBeGreaterThan(0);
  });

  it('uses proposal mode + a rules agreement when both flags are on', () => {
    const t = standardContestTemplate({ proposals: true, pii: true });
    const sub = t.stages.find((s) => s.kind === 'submission')!;
    expect(sub.submissionMode).toBe('proposal');
    const keys = (sub.submissionTemplate ?? []).map((f) => f.key);
    expect(keys).toContain('project_name');
    expect(keys).toContain('rules_agreement');
    const agreement = sub.submissionTemplate!.find((f) => f.key === 'rules_agreement')!;
    expect(agreement.type).toBe('agreement');
    expect(agreement.mustAccept).toBe(true);
    expect(agreement.terms?.length).toBeGreaterThan(0);
  });

  it('degrades to attach mode with no agreement when the flags are off', () => {
    const t = standardContestTemplate({ proposals: false, pii: false });
    const sub = t.stages.find((s) => s.kind === 'submission')!;
    expect(sub.submissionMode).toBe('attach');
    expect((sub.submissionTemplate ?? []).some((f) => f.type === 'agreement')).toBe(false);
    // The non-PII proposal fields still seed (a form without the consent gate).
    expect((sub.submissionTemplate ?? []).map((f) => f.key)).toContain('description');
  });

  it('seeds an agreement only with PII on, regardless of proposal mode', () => {
    const piiOnly = standardContestTemplate({ proposals: false, pii: true });
    const sub = piiOnly.stages.find((s) => s.kind === 'submission')!;
    expect(sub.submissionMode).toBe('attach');
    expect((sub.submissionTemplate ?? []).some((f) => f.key === 'rules_agreement')).toBe(true);
  });

  it.each([
    { proposals: true, pii: true },
    { proposals: true, pii: false },
    { proposals: false, pii: true },
    { proposals: false, pii: false },
  ])('every seeded stage passes the server contestStageSchema (flags %o)', (flags) => {
    const t = standardContestTemplate(flags);
    for (const stage of t.stages) {
      const result = contestStageSchema.safeParse(stage);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it('seeds stable, unique, schema-valid field keys', () => {
    const t = standardContestTemplate({ proposals: true, pii: true });
    const keys = (t.stages.find((s) => s.kind === 'submission')!.submissionTemplate ?? []).map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9_]+$/);
  });
});
