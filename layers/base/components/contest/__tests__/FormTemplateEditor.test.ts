/**
 * Component tests for the shared FormTemplateEditor (extracted from the stage
 * editor, P4): one-click field PRESETS, whole-form TEMPLATES, the block INTRO
 * (stage-only, gated by enableIntro), keyboard up/down REORDER, and the new field
 * types (section/radio/tel) + maxLength. The pure data ops are covered in
 * utils/__tests__; these assert the wiring.
 *
 * useFeatures is auto-imported; stub it on globalThis, along with the auto-imported
 * util ops + the TEMPLATE_FIELD_TYPE_LABEL map.
 */
import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import FormTemplateEditor from '../FormTemplateEditor.vue';
import * as stageUtils from '../../../utils/contestStages';
import type { FormField } from '@commonpub/schema';
import { markdownToBlockTuples, type BlockTuple } from '@commonpub/editor';

Object.assign(globalThis, stageUtils);

function stubFeatures(pii: boolean) {
  Object.assign(globalThis, { useFeatures: () => ({ features: ref({ contestPii: pii }) }) });
}

const stubs = {
  BlocksBlockContentRenderer: { props: ['blocks'], template: '<div class="render-stub" :data-count="blocks.length" />' },
};

function mount(template: FormField[] = [], pii = true, opts: { instructions?: BlockTuple[]; enableIntro?: boolean } = {}) {
  stubFeatures(pii);
  const emitted: { template?: FormField[]; instructions?: BlockTuple[] } = {};
  const utils = render(FormTemplateEditor, {
    props: {
      template,
      instructions: opts.instructions ?? [],
      enableIntro: opts.enableIntro ?? true,
      'onUpdate:template': (v: FormField[]) => { emitted.template = v; },
      'onUpdate:instructions': (v: BlockTuple[]) => { emitted.instructions = v; },
    },
    global: { stubs, mocks: { TEMPLATE_FIELD_TYPE_LABEL: stageUtils.TEMPLATE_FIELD_TYPE_LABEL } },
  });
  return { ...utils, emitted };
}

describe('FormTemplateEditor — presets', () => {
  it('opens the Add field menu and appends a preset with a unique key', async () => {
    const { getByRole, getAllByRole, emitted } = mount([{ key: 'email_address', label: 'Email address', type: 'email', required: false }]);
    await fireEvent.click(getByRole('button', { name: /add field/i }));
    await fireEvent.click(getAllByRole('menuitem').find((b) => b.textContent?.includes('Email'))!);
    expect(emitted.template).toHaveLength(2);
    expect(new Set(emitted.template!.map((f) => f.key)).size).toBe(2);
  });

  it('offers the new field types (radio / phone / section)', async () => {
    const { getByRole, getAllByRole } = mount([]);
    await fireEvent.click(getByRole('button', { name: /add field/i }));
    const labels = getAllByRole('menuitem').map((b) => b.textContent).join();
    expect(labels).toMatch(/Choice \(radio\)/);
    expect(labels).toMatch(/Phone/);
    expect(labels).toMatch(/Section header/);
  });

  it('hides the address/agreement presets when PII is off', async () => {
    const { getByRole, getAllByRole } = mount([], false);
    await fireEvent.click(getByRole('button', { name: /add field/i }));
    expect(getAllByRole('menuitem').map((b) => b.textContent).join()).not.toMatch(/Mailing address|Agreement/);
  });
});

describe('FormTemplateEditor — form templates', () => {
  it('fills the form from a template when empty (no confirm)', async () => {
    const { getByRole, getAllByRole, emitted } = mount([]);
    await fireEvent.click(getByRole('button', { name: /use a template/i }));
    await fireEvent.click(getAllByRole('menuitem').find((b) => b.textContent?.includes('Standard proposal'))!);
    expect(emitted.template!.map((f) => f.key)).toContain('project_name');
  });

  it('confirms before replacing a non-empty form', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { getByRole, getAllByRole, emitted } = mount([{ key: 'existing', label: 'Existing', type: 'text', required: false }]);
    await fireEvent.click(getByRole('button', { name: /use a template/i }));
    await fireEvent.click(getAllByRole('menuitem').find((b) => b.textContent?.includes('Minimal'))!);
    expect(confirm).toHaveBeenCalled();
    expect(emitted.template).toBeUndefined();
    confirm.mockRestore();
  });
});

describe('FormTemplateEditor — reorder', () => {
  it('moves a field down via the reorder button and emits the reordered array', async () => {
    const { getByLabelText, emitted } = mount([
      { key: 'a', label: 'Alpha', type: 'text', required: false },
      { key: 'b', label: 'Beta', type: 'text', required: false },
    ]);
    await fireEvent.click(getByLabelText(/move alpha down/i));
    expect(emitted.template!.map((f) => f.key)).toEqual(['b', 'a']);
  });

  it('disables Up on the first field and Down on the last', () => {
    const { getByLabelText } = mount([
      { key: 'a', label: 'Alpha', type: 'text', required: false },
      { key: 'b', label: 'Beta', type: 'text', required: false },
    ]);
    expect((getByLabelText(/move alpha up/i) as HTMLButtonElement).disabled).toBe(true);
    expect((getByLabelText(/move beta down/i) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('FormTemplateEditor — maxLength', () => {
  it('sets a per-field character cap for a text field', async () => {
    const { getByLabelText, emitted } = mount([{ key: 'b', label: 'Building', type: 'textarea', required: false }]);
    await fireEvent.update(getByLabelText(/field 1 max length/i), '280');
    expect(emitted.template![0]!.maxLength).toBe(280);
  });
});

describe('FormTemplateEditor — block intro (stage-only)', () => {
  it('reveals the intro editor and emits blocks on input', async () => {
    const { getByLabelText, emitted } = mount();
    await fireEvent.click(getByLabelText(/add instructions above the form/i));
    await fireEvent.update(getByLabelText(/form instructions/i), 'Tell us your idea.');
    expect(emitted.instructions!.length).toBeGreaterThan(0);
  });

  it('hides the intro affordance when enableIntro is false (registration)', () => {
    const { queryByLabelText } = mount([], true, { enableIntro: false });
    expect(queryByLabelText(/add instructions above the form/i)).toBeNull();
  });

  it('passes an axe scan with presets + intro present', async () => {
    const { container, getByLabelText } = mount([{ key: 'f', label: 'F', type: 'text', required: false }]);
    await fireEvent.click(getByLabelText(/add instructions above the form/i));
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
