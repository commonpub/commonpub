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

function stubFeatures(pii: boolean, conditionalFields = true) {
  Object.assign(globalThis, {
    useFeatures: () => ({ features: ref({ contestPii: pii, contestConditionalFields: conditionalFields }) }),
  });
}

const stubs = {
  BlocksBlockContentRenderer: { props: ['blocks'], template: '<div class="render-stub" :data-count="blocks.length" />' },
};

function mount(template: FormField[] = [], pii = true, opts: { instructions?: BlockTuple[]; enableIntro?: boolean; conditionalFields?: boolean; lockedKeys?: string[] } = {}) {
  stubFeatures(pii, opts.conditionalFields ?? true);
  const emitted: { template?: FormField[]; instructions?: BlockTuple[] } = {};
  const utils = render(FormTemplateEditor, {
    props: {
      template,
      lockedKeys: opts.lockedKeys ?? [],
      enableMarkdown: true,
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

// ─── Conditional display (P7) ───
// The pure ops are covered in utils/__tests__/contestConditions.test.ts; these
// assert the WIRING: the control appears only where it can be used, the flag
// gates it, and the source dropdown offers exactly what the validator accepts.
describe('FormTemplateEditor — conditional display', () => {
  const SOURCE: FormField = { key: 'is_entity', label: 'Registered entity', type: 'checkbox', required: false };
  const TARGET: FormField = { key: 'doc', label: 'Proof', type: 'text', required: false };

  it('offers the control on a field with an eligible source above it', () => {
    const { container } = mount([SOURCE, TARGET]);
    const controls = container.querySelectorAll('.cpub-fte-cond');
    expect(controls).toHaveLength(1); // the checkbox itself has nothing above it
  });

  it('does not offer it when nothing above can drive a condition', () => {
    const { container } = mount([{ key: 'name', label: 'Name', type: 'text', required: false }, TARGET]);
    expect(container.querySelectorAll('.cpub-fte-cond')).toHaveLength(0);
  });

  it('is hidden entirely when contestConditionalFields is off', () => {
    const { container } = mount([SOURCE, TARGET], true, { conditionalFields: false });
    expect(container.querySelectorAll('.cpub-fte-cond')).toHaveLength(0);
  });

  it('turning the rule on seeds the first eligible source with no values yet', async () => {
    const { container, emitted } = mount([SOURCE, TARGET]);
    await fireEvent.click(container.querySelector('.cpub-fte-cond input[type=checkbox]')!);
    expect(emitted.template?.[1]?.showWhen).toEqual({ field: 'is_entity', equals: [] });
  });

  it('checking a value adds it, and unchecking the last one removes the rule', async () => {
    const withRule: FormField[] = [SOURCE, { ...TARGET, showWhen: { field: 'is_entity', equals: [] } }];
    const { container, emitted } = mount(withRule);
    const valueBoxes = container.querySelectorAll('.cpub-fte-cond-values input[type=checkbox]');
    expect(valueBoxes).toHaveLength(2); // Checked / Not checked
    await fireEvent.click(valueBoxes[0]!);
    expect(emitted.template?.[1]?.showWhen).toEqual({ field: 'is_entity', equals: ['true'] });

    const checked: FormField[] = [SOURCE, { ...TARGET, showWhen: { field: 'is_entity', equals: ['true'] } }];
    const second = mount(checked);
    await fireEvent.click(second.container.querySelectorAll('.cpub-fte-cond-values input[type=checkbox]')[0]!);
    expect(second.emitted.template?.[1]?.showWhen).toBeUndefined();
  });

  it('a section card offers the same rule, worded for a section', () => {
    const { container } = mount([SOURCE, { key: 'sec', label: 'Org', type: 'section', required: false }]);
    expect(container.querySelector('.cpub-fte-cond')?.textContent).toContain('Only show this section when');
  });
});

// Round-2 audit: markdown import recomputed every key from its label, walking
// straight past the key lock and orphaning every stored answer under the old key.
describe('FormTemplateEditor — markdown import preserves saved keys', () => {
  const saved: FormField[] = [
    { key: 'repositry_url', label: 'Repository URL', type: 'url', required: false },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ];

  it('carries a saved key onto the imported field with the same label', async () => {
    const { container, emitted } = mount(saved, true, { lockedKeys: ['repositry_url', 'notes'] });
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Markdown/i.test(b.textContent || ''))!);
    const ta = container.querySelector('.cpub-fte-md-text') as HTMLTextAreaElement;
    await fireEvent.update(ta, ['- Repository URL (url)', '- Notes (textarea)'].join('\n'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Import/i.test(b.textContent || ''))!);

    // The key that answers hang off survives; without this it became `repository_url`.
    expect(emitted.template?.map((f) => f.key)).toEqual(['repositry_url', 'notes']);
  });

  it('re-points a condition at the preserved key instead of silently dropping it', async () => {
    // Hand-written markdown names fields by LABEL, so the parser derives
    // `repository_url`. Preservation then restores the saved key `repositry_url`
    // on that field — and a condition still pointing at the derived key is
    // orphaned, which the repair pass deletes without a word.
    const withSource: FormField[] = [
      { key: 'repositry_url', label: 'Has a repository', type: 'checkbox', required: false },
      { key: 'notes', label: 'Notes', type: 'textarea', required: false },
    ];
    const { container, emitted } = mount(withSource, true, { lockedKeys: ['repositry_url', 'notes'] });
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Markdown/i.test(b.textContent || ''))!);
    await fireEvent.update(
      container.querySelector('.cpub-fte-md-text') as HTMLTextAreaElement,
      ['- Has a repository (checkbox)', '- Notes (textarea, show=has_a_repository:true)'].join('\n'),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Import/i.test(b.textContent || ''))!);

    expect(emitted.template?.[0]?.key).toBe('repositry_url');
    expect(emitted.template?.[1]?.showWhen).toEqual({ field: 'repositry_url', equals: ['true'] });
  });

  it('names the fields whose answers would be orphaned in the confirm dialog', async () => {
    const { container } = mount(saved, true, { lockedKeys: ['repositry_url', 'notes'] });
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Markdown/i.test(b.textContent || ''))!);
    await fireEvent.update(container.querySelector('.cpub-fte-md-text') as HTMLTextAreaElement, '- Something else (text)');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await fireEvent.click([...container.querySelectorAll('button')].find((b) => /Import/i.test(b.textContent || ''))!);

    const msg = confirmSpy.mock.calls[0]![0] as string;
    expect(msg).toContain('no longer match existing answers');
    expect(msg).toContain('Repository URL');
  });
});
