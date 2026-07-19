/**
 * Component tests for ContestRegistrationForm — the template-driven registration
 * form. Locks: rendering from the template, dirty-gated Save, required-blocks-Save,
 * the emitted collected answers, preview read-only mode, and an axe scan.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestRegistrationForm from '../ContestRegistrationForm.vue';
import ContestSubmissionField from '../ContestSubmissionField.vue';
import type { FormField } from '@commonpub/schema';

// ContestSubmissionField (rendered as a child) auto-imports useFeatures/useFileUpload.
Object.assign(globalThis, {
  useFeatures: () => ({ features: ref({ contestPrivateFiles: true }) }),
  useFileUpload: () => ({ uploadFile: async () => ({ id: 'f-1', url: '/api/files/f-1/raw', originalName: 'doc.pdf' }) }),
});

const TEMPLATE: FormField[] = [
  { key: 'sec', label: 'About you', type: 'section', required: false },
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'country', label: 'Country', type: 'radio', required: true, options: [{ value: 'us', label: 'US' }, { value: 'ca', label: 'Canada' }] },
];

function mount(props: Record<string, unknown> = {}) {
  return render(ContestRegistrationForm, {
    props: { template: TEMPLATE, ...props },
    global: { components: { ContestSubmissionField }, stubs: { 'i': true } },
  });
}

const saveBtn = (c: Element) => c.querySelector('.cpub-regform-save') as HTMLButtonElement;

describe('ContestRegistrationForm', () => {
  it('renders one control per template field (section has no input)', () => {
    const { container } = mount();
    expect(container.querySelector('.cpub-subfield-section-title')?.textContent).toContain('About you');
    expect(container.querySelector('#cpub-reg-name')).not.toBeNull();
    expect(container.querySelector('[role=radiogroup]')).not.toBeNull();
  });

  it('Save is disabled until dirty AND all required fields are provided', async () => {
    const { container } = mount();
    expect(saveBtn(container).disabled).toBe(true); // pristine

    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    // name filled but required radio still missing → still blocked
    expect(saveBtn(container).disabled).toBe(true);
    expect(container.querySelector('.cpub-regform-missing')).not.toBeNull();

    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!);
    expect(saveBtn(container).disabled).toBe(false);
  });

  it('emits the collected answers on Save (section excluded, empty omitted)', async () => {
    const { container, emitted } = mount();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!);
    await fireEvent.click(saveBtn(container));
    expect(emitted().save?.at(-1)).toEqual([{ name: 'Ada', country: 'us' }]);
  });

  it('prefills from savedFields and stays clean (Save disabled) until edited', async () => {
    const { container } = mount({ savedFields: { name: 'Grace', country: 'ca' } });
    expect((container.querySelector('#cpub-reg-name') as HTMLInputElement).value).toBe('Grace');
    expect(saveBtn(container).disabled).toBe(true); // matches saved ⇒ not dirty
  });

  it('preview mode disables inputs and hides Save', () => {
    const { container } = mount({ preview: true });
    expect(saveBtn(container)).toBeNull();
    expect((container.querySelector('.cpub-regform-fields') as HTMLFieldSetElement).disabled).toBe(true);
  });

  it('passes an axe scan', async () => {
    const { container } = mount();
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
