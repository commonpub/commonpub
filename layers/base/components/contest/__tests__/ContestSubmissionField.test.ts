/**
 * Component tests for ContestSubmissionField — the shared entrant control used
 * by the per-stage artifact form and the proposal form. Locks the control type
 * per field type, the address JSON round-trip, agreement/checkbox 'true' model,
 * and an axe scan across the full type set.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestSubmissionField from '../ContestSubmissionField.vue';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';

function mount(field: ContestSubmissionTemplateField, modelValue = '') {
  return render(ContestSubmissionField, { props: { field, modelValue, idPrefix: 'cpub-test' } });
}

describe('ContestSubmissionField — control per type', () => {
  it('renders the right input type for scalar fields', () => {
    const { container: email } = mount({ key: 'e', label: 'Email', type: 'email', required: true });
    expect(email.querySelector('#cpub-test-e')?.getAttribute('type')).toBe('email');
    const { container: num } = mount({ key: 'n', label: 'Num', type: 'number', required: false });
    expect(num.querySelector('#cpub-test-n')?.getAttribute('type')).toBe('number');
    const { container: date } = mount({ key: 'd', label: 'Date', type: 'date', required: false });
    expect(date.querySelector('#cpub-test-d')?.getAttribute('type')).toBe('date');
  });

  it('renders a select with the configured options', () => {
    const { container } = mount({ key: 'track', label: 'Track', type: 'select', required: true, options: [
      { value: 'hw', label: 'Hardware' }, { value: 'sw', label: 'Software' },
    ] });
    const sel = container.querySelector('#cpub-test-track') as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual(expect.arrayContaining(['Hardware', 'Software']));
  });

  it('emits true/empty for a checkbox', async () => {
    const { container, emitted } = mount({ key: 'opt', label: 'Opt in', type: 'checkbox', required: false });
    await fireEvent.click(container.querySelector('#cpub-test-opt')!);
    expect(emitted()['update:modelValue']!.at(-1)).toEqual(['true']);
  });

  it('shows agreement terms + an accept checkbox', async () => {
    const { container, emitted } = mount({ key: 'tos', label: 'Terms', type: 'agreement', required: true, mustAccept: true, terms: 'Ship the hardware.' });
    expect(container.querySelector('.cpub-subfield-terms')?.textContent).toContain('Ship the hardware.');
    await fireEvent.click(container.querySelector('input[type=checkbox]')!);
    expect(emitted()['update:modelValue']!.at(-1)).toEqual(['true']);
  });

  it('serializes the address subfields into a JSON model and parses back', async () => {
    const { container, emitted } = mount({ key: 'addr', label: 'Address', type: 'address', required: true });
    const inputs = container.querySelectorAll('.cpub-subfield-address input');
    await fireEvent.update(inputs[0]!, '1 Main St'); // line1
    const calls = emitted()['update:modelValue'] as unknown[][];
    const last = (calls.at(-1) as unknown[])[0] as string;
    expect(JSON.parse(last)).toEqual({ line1: '1 Main St' });

    // Parses an existing value back into the subfields.
    const { container: filled } = mount({ key: 'addr', label: 'Address', type: 'address', required: true }, JSON.stringify({ line1: '5 Oak', city: 'Town' }));
    const vals = Array.from(filled.querySelectorAll('.cpub-subfield-address input')).map((i) => (i as HTMLInputElement).value);
    expect(vals).toContain('5 Oak');
    expect(vals).toContain('Town');
  });

  // --- P3 field types (section / radio / tel) ---
  it('renders a section as a display-only header with no input', () => {
    const { container } = mount({ key: 'sec', label: 'About you', type: 'section', required: false, help: 'A few details.' });
    expect(container.querySelector('.cpub-subfield-section-title')?.textContent).toContain('About you');
    expect(container.querySelector('.cpub-subfield-section-desc')?.textContent).toContain('A few details.');
    // No form control at all.
    expect(container.querySelector('input, select, textarea')).toBeNull();
  });

  it('renders a radio group and emits the chosen option value', async () => {
    const { container, emitted } = mount({ key: 'track', label: 'Track', type: 'radio', required: true, options: [
      { value: 'dev', label: 'Developer' }, { value: 'startup', label: 'Startup' },
    ] });
    const group = container.querySelector('[role=radiogroup]');
    expect(group).not.toBeNull();
    const radios = container.querySelectorAll('input[type=radio]');
    expect(radios).toHaveLength(2);
    await fireEvent.click(radios[1]!);
    expect(emitted()['update:modelValue']!.at(-1)).toEqual(['startup']);
  });

  it('applies a per-field maxLength to text-ish inputs (defaults to 4000)', () => {
    const { container: capped } = mount({ key: 'b', label: 'Building', type: 'textarea', required: false, maxLength: 280 });
    expect(capped.querySelector('#cpub-test-b')?.getAttribute('maxlength')).toBe('280');
    const { container: def } = mount({ key: 't', label: 'Text', type: 'text', required: false });
    expect(def.querySelector('#cpub-test-t')?.getAttribute('maxlength')).toBe('4000');
  });

  it('renders a section as a plain (non-heading) styled divider', () => {
    const { container } = mount({ key: 'sec', label: 'About', type: 'section', required: false });
    const title = container.querySelector('.cpub-subfield-section-title');
    expect(title?.tagName.toLowerCase()).toBe('div'); // not a heading → no outline jump
  });

  it('renders a tel field as an input type=tel', () => {
    const { container } = mount({ key: 'phone', label: 'Phone', type: 'tel', required: false });
    const input = container.querySelector('#cpub-test-phone');
    expect(input?.getAttribute('type')).toBe('tel');
    expect(input?.getAttribute('inputmode')).toBe('tel');
  });

  it('passes an axe scan for every field type', async () => {
    const fields: ContestSubmissionTemplateField[] = [
      { key: 'a', label: 'Text', type: 'text', required: true, help: 'Hint' },
      { key: 'b', label: 'Email', type: 'email', required: true },
      { key: 'c', label: 'Track', type: 'select', required: true, options: [{ value: 'x', label: 'X' }] },
      { key: 'd', label: 'Opt', type: 'checkbox', required: false },
      { key: 'e', label: 'Terms', type: 'agreement', required: true, terms: 'OK', mustAccept: true },
      { key: 'f', label: 'Address', type: 'address', required: true },
      { key: 'g', label: 'Section', type: 'section', required: false, help: 'Divider' },
      { key: 'h', label: 'Choice', type: 'radio', required: true, options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
      { key: 'i', label: 'Phone', type: 'tel', required: false },
    ];
    for (const field of fields) {
      const { container } = mount(field);
      const results = await axe.run(container);
      expect(results.violations, `${field.type} a11y`).toEqual([]);
    }
  });
});
