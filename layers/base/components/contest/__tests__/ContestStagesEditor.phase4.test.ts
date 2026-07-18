/**
 * Component tests for the Phase 4 submission-form builder in ContestStagesEditor:
 * the widened field-type set (flag-gated), the select-options + agreement-terms
 * editors, the per-field PII toggle, and the per-stage submission-mode selector.
 *
 * useFeatures is auto-imported; stub it on globalThis with the Phase 4 flags ON.
 * Child editors (dates, criteria) are stubbed to focus on the builder.
 */
import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestStagesEditor from '../ContestStagesEditor.vue';
import * as stageUtils from '../../../utils/contestStages';
import type { ContestStage } from '@commonpub/schema';

// The editor relies on auto-imported utils (STAGE_KIND_LABEL, the with* helpers,
// TEMPLATE_FIELD_TYPE_LABEL, …); auto-imports aren't wired in the layer vitest
// env, so expose the whole module on globalThis before rendering.
Object.assign(globalThis, stageUtils);

function stubFeatures(flags: Record<string, boolean>) {
  Object.assign(globalThis, {
    useFeatures: () => ({ features: ref({ contestStageSubmissions: true, contestPii: false, contestProposals: false, ...flags }) }),
  });
}

const stubs = {
  CpubDateTimeField: { props: ['modelValue', 'min', 'max', 'label'], template: '<div class="cpub-dt" />' },
  ContestCriteriaEditor: { props: ['modelValue', 'label', 'showTotal'], template: '<div class="cpub-criteria-stub" />' },
};

function mount(stage: Partial<ContestStage>, flags: Record<string, boolean> = {}) {
  stubFeatures(flags);
  const stages: ContestStage[] = [{ id: 's1', name: 'Proposals', kind: 'submission', ...stage }];
  return render(ContestStagesEditor, {
    props: {
      modelValue: stages,
      currentStageId: 's1',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-08-01T00:00:00.000Z',
      'onUpdate:modelValue': (v: ContestStage[]) => { stages.splice(0, stages.length, ...v); },
    },
    global: {
      stubs,
      // Template-level auto-imported lookup maps resolve via the render context,
      // not globalThis — expose them as VTU mocks.
      mocks: {
        STAGE_KIND_LABEL: stageUtils.STAGE_KIND_LABEL,
        STAGE_KIND_ICON: stageUtils.STAGE_KIND_ICON,
        STAGE_KIND_HELP: (stageUtils as Record<string, unknown>).STAGE_KIND_HELP,
        TEMPLATE_FIELD_TYPE_LABEL: stageUtils.TEMPLATE_FIELD_TYPE_LABEL,
      },
    },
  });
}

describe('ContestStagesEditor — Phase 4 builder', () => {
  it('offers the new scalar types but hides agreement/address until contestPii is on', () => {
    const { container } = mount({ submissionTemplate: [{ key: 'f', label: 'F', type: 'text', required: false }] });
    const typeSelect = container.querySelector('.cpub-fte-type') as HTMLSelectElement;
    const opts = Array.from(typeSelect.options).map((o) => o.value);
    expect(opts).toEqual(expect.arrayContaining(['text', 'email', 'number', 'select', 'checkbox', 'date']));
    expect(opts).not.toContain('agreement');
    expect(opts).not.toContain('address');
  });

  it('reveals agreement + address and the PII toggle when contestPii is on', () => {
    const { container } = mount(
      { submissionTemplate: [{ key: 'f', label: 'F', type: 'text', required: false }] },
      { contestPii: true },
    );
    const typeSelect = container.querySelector('.cpub-fte-type') as HTMLSelectElement;
    const opts = Array.from(typeSelect.options).map((o) => o.value);
    expect(opts).toEqual(expect.arrayContaining(['agreement', 'address']));
    // A non-address scalar field shows the PII toggle.
    expect(container.querySelector('.cpub-fte-pii')).toBeTruthy();
  });

  it('renders the options editor for a select field', () => {
    const { container } = mount(
      { submissionTemplate: [{ key: 'track', label: 'Track', type: 'select', required: true, options: [{ value: 'hw', label: 'Hardware' }] }] },
      { contestPii: true },
    );
    const extra = container.querySelector('.cpub-fte-extra');
    expect(extra?.textContent).toContain('Choices');
    expect((extra?.querySelector('input') as HTMLInputElement).value).toBe('Hardware');
  });

  it('renders the terms editor for an agreement field', () => {
    const { container } = mount(
      { submissionTemplate: [{ key: 'tos', label: 'Terms', type: 'agreement', required: true, terms: 'Ship it.', mustAccept: true }] },
      { contestPii: true },
    );
    const textarea = container.querySelector('.cpub-fte-extra textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Ship it.');
    expect(container.textContent).toContain('Must accept to submit');
  });

  it('shows the submission-mode selector only when contestProposals is on', () => {
    const { container: off } = mount({ submissionTemplate: [] });
    expect(off.querySelector('#stage-mode-0')).toBeNull();

    const { container: on } = mount({ submissionTemplate: [] }, { contestProposals: true });
    const sel = on.querySelector('#stage-mode-0') as HTMLSelectElement;
    expect(sel).toBeTruthy();
    expect(Array.from(sel.options).map((o) => o.value)).toEqual(['attach', 'proposal']);
  });

  it('passes an axe scan with the Phase 4 controls present', async () => {
    const { container } = mount(
      { submissionTemplate: [
        { key: 'track', label: 'Track', type: 'select', required: true, options: [{ value: 'hw', label: 'Hardware' }] },
        { key: 'tos', label: 'Terms', type: 'agreement', required: true, terms: 'Ship it.', mustAccept: true },
      ] },
      { contestPii: true, contestProposals: true },
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
