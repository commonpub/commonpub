/**
 * Component tests for the P2 submission-form builder upgrades on
 * ContestStageTemplateEditor: one-click field PRESETS, whole-form TEMPLATES, and
 * the block INTRO (markdown ⇄ BlockTuple[]). The pure data is covered in
 * utils/__tests__/contestSubmissionTemplates.test.ts; these assert the wiring.
 *
 * useFeatures is auto-imported; stub it on globalThis. The auto-imported lookup
 * maps + BlockContentRenderer are exposed as VTU mocks/stubs.
 */
import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestStageTemplateEditor from '../ContestStageTemplateEditor.vue';
import * as stageUtils from '../../../utils/contestStages';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { markdownToBlockTuples, type BlockTuple } from '@commonpub/editor';

Object.assign(globalThis, stageUtils);

function stubFeatures(pii: boolean) {
  Object.assign(globalThis, {
    useFeatures: () => ({ features: ref({ contestPii: pii }) }),
  });
}

const stubs = {
  BlocksBlockContentRenderer: { props: ['blocks'], template: '<div class="render-stub" :data-count="blocks.length" />' },
};

function mount(template: ContestSubmissionTemplateField[] = [], pii = true, instructions: BlockTuple[] = []) {
  stubFeatures(pii);
  const emitted: { template?: ContestSubmissionTemplateField[]; instructions?: BlockTuple[] } = {};
  const utils = render(ContestStageTemplateEditor, {
    props: {
      template,
      instructions,
      'onUpdate:template': (v: ContestSubmissionTemplateField[]) => { emitted.template = v; },
      'onUpdate:instructions': (v: BlockTuple[]) => { emitted.instructions = v; },
    },
    global: { stubs, mocks: { TEMPLATE_FIELD_TYPE_LABEL: stageUtils.TEMPLATE_FIELD_TYPE_LABEL } },
  });
  return { ...utils, emitted };
}

describe('ContestStageTemplateEditor — P2 presets', () => {
  it('opens the Add field menu and appends a preset field with a unique key', async () => {
    const { getByRole, getAllByRole, emitted } = mount([{ key: 'email_address', label: 'Email address', type: 'email', required: false }]);
    await fireEvent.click(getByRole('button', { name: /add field/i }));
    const email = getAllByRole('menuitem').find((b) => b.textContent?.includes('Email'))!;
    await fireEvent.click(email);
    expect(emitted.template).toHaveLength(2);
    expect(new Set(emitted.template!.map((f) => f.key)).size).toBe(2);
  });

  it('hides the address/agreement presets when PII is off', async () => {
    const { getByRole, getAllByRole } = mount([], false);
    await fireEvent.click(getByRole('button', { name: /add field/i }));
    const labels = getAllByRole('menuitem').map((b) => b.textContent);
    expect(labels.join()).not.toMatch(/Mailing address|Agreement/);
  });
});

describe('ContestStageTemplateEditor — P2 form templates', () => {
  it('fills the form from a template when empty (no confirm)', async () => {
    const { getByRole, getAllByRole, emitted } = mount([]);
    await fireEvent.click(getByRole('button', { name: /use a template/i }));
    const standard = getAllByRole('menuitem').find((b) => b.textContent?.includes('Standard proposal'))!;
    await fireEvent.click(standard);
    expect(emitted.template!.map((f) => f.key)).toContain('project_name');
  });

  it('confirms before replacing a non-empty form', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { getByRole, getAllByRole, emitted } = mount([{ key: 'existing', label: 'Existing', type: 'text', required: false }]);
    await fireEvent.click(getByRole('button', { name: /use a template/i }));
    await fireEvent.click(getAllByRole('menuitem').find((b) => b.textContent?.includes('Minimal'))!);
    expect(confirm).toHaveBeenCalled();
    expect(emitted.template).toBeUndefined(); // declined → no emit
    confirm.mockRestore();
  });
});

describe('ContestStageTemplateEditor — P2 block intro', () => {
  it('reveals the intro editor and emits blocks on input', async () => {
    const { getByLabelText, emitted } = mount();
    await fireEvent.click(getByLabelText(/add instructions above the form/i));
    const textarea = getByLabelText(/form instructions/i);
    await fireEvent.update(textarea, 'Tell us your idea.');
    expect(emitted.instructions!.length).toBeGreaterThan(0);
    expect(JSON.stringify(emitted.instructions)).toContain('Tell us your idea');
  });

  it('seeds the editor open with existing instructions', () => {
    const blocks = markdownToBlockTuples('Existing intro') as BlockTuple[];
    const { getByLabelText } = mount([], true, blocks);
    expect((getByLabelText(/form instructions/i) as HTMLTextAreaElement).value).toContain('Existing intro');
  });

  it('passes an axe scan with presets + intro present', async () => {
    const { container, getByLabelText } = mount([{ key: 'f', label: 'F', type: 'text', required: false }]);
    await fireEvent.click(getByLabelText(/add instructions above the form/i));
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
