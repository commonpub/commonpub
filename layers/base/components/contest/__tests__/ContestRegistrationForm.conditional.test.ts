/**
 * Component tests for conditional display (P7) on the registration form.
 *
 * The pure resolution rules are covered in @commonpub/schema; these lock the
 * COMPONENT behaviour that a participant actually experiences: a hidden field has
 * no control on the page, does not block Save, and never reaches the emitted
 * answers — and the operator preview still shows every field, marked.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestRegistrationForm from '../ContestRegistrationForm.vue';
import ContestSubmissionField from '../ContestSubmissionField.vue';
import type { FormField } from '@commonpub/schema';

Object.assign(globalThis, {
  useFeatures: () => ({ features: ref({ contestPrivateFiles: true }) }),
  useFileUpload: () => ({ uploadFile: async () => ({ id: 'f-1', url: '/api/files/f-1/raw', originalName: 'doc.pdf' }) }),
});

const TEMPLATE: FormField[] = [
  {
    key: 'track', label: 'Challenge track', type: 'radio', required: true,
    options: [{ value: 'developer', label: 'Developer' }, { value: 'startup', label: 'Startup' }],
  },
  { key: 'is_entity', label: 'Registered US entity', type: 'checkbox', required: false },
  // Field-level rule.
  { key: 'ein', label: 'EIN', type: 'text', required: true, showWhen: { field: 'is_entity', equals: ['true'] } },
  // Section-level rule, gating everything down to the next section.
  { key: 'ship', label: 'Shipping', type: 'section', required: false, showWhen: { field: 'track', equals: ['startup'] } },
  { key: 'recipient', label: 'Recipient', type: 'text', required: true },
  { key: 'closing', label: 'Closing', type: 'section', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
];

function mount(props: Record<string, unknown> = {}) {
  return render(ContestRegistrationForm, {
    props: { template: TEMPLATE, ...props },
    global: { components: { ContestSubmissionField }, stubs: { i: true } },
  });
}

const saveBtn = (c: Element) => c.querySelector('.cpub-regform-save') as HTMLButtonElement;
const has = (c: Element, id: string) => c.querySelector(`#cpub-reg-${id}`) !== null;

describe('ContestRegistrationForm — conditional display', () => {
  it('hides a conditional field and its gated section on a pristine form', () => {
    const { container } = mount();
    expect(container.querySelector('[role=radiogroup]')).not.toBeNull(); // the source is shown
    expect(has(container, 'is_entity')).toBe(true);
    expect(has(container, 'ein')).toBe(false);
    expect(has(container, 'recipient')).toBe(false);
    // The gate reopens at the next unconditional section.
    expect(has(container, 'notes')).toBe(true);
  });

  it('does not count a hidden required field against Save', async () => {
    const mounted = mount();
    const { container } = mounted;
    // Only `track` is required and visible; answering it should unblock Save even
    // though `ein` and `recipient` are required-but-hidden.
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!); // developer
    const { emitted } = mounted;
    await fireEvent.click(saveBtn(container));
    expect(emitted().save).toBeDefined();
  });

  it('reveals a field when its checkbox source is checked, and then requires it', async () => {
    const { container, emitted } = mount();
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!);
    expect(saveBtn(container).disabled).toBe(false);

    await fireEvent.click(container.querySelector('#cpub-reg-is_entity')!);
    expect(has(container, 'ein')).toBe(true);
    // Newly shown and required: saving now reports it rather than emitting.
    await fireEvent.click(saveBtn(container));
    expect(emitted().save).toBeUndefined();
    expect(container.querySelector('.cpub-regform-summary')!.textContent).toContain('EIN');

    await fireEvent.update(container.querySelector('#cpub-reg-ein')!, '12-3456789');
    await fireEvent.click(saveBtn(container));
    expect(emitted().save).toBeDefined();
  });

  it('reveals a whole section when its source matches', async () => {
    const { container, emitted } = mount();
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[1]!); // startup
    expect(has(container, 'recipient')).toBe(true);
    // `recipient` is required now, so the save is reported back instead of emitted.
    await fireEvent.click(saveBtn(container));
    expect(emitted().save).toBeUndefined();
    expect(container.querySelector('.cpub-regform-summary')!.textContent).toContain('Recipient');
  });

  it('drops a hidden answer from the emitted payload', async () => {
    const { container, emitted } = mount();
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[1]!); // startup → shipping shown
    await fireEvent.update(container.querySelector('#cpub-reg-recipient')!, 'Ada');
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!); // back to developer → hidden again

    expect(has(container, 'recipient')).toBe(false);
    expect(saveBtn(container).disabled).toBe(false);
    await fireEvent.click(saveBtn(container));

    const payload = (emitted().save as unknown[][])[0]![0] as Record<string, string>;
    expect(payload).toEqual({ track: 'developer' });
    expect('recipient' in payload).toBe(false);
  });

  it('preview shows every field, each conditional one marked with its rule', () => {
    const { container } = mount({ preview: true });
    // Nothing is filtered out in preview: the operator is inspecting the form.
    expect(has(container, 'ein')).toBe(true);
    expect(has(container, 'recipient')).toBe(true);
    const notes = [...container.querySelectorAll('.cpub-regform-conditional')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('Registered US entity');
    expect(notes[0]).toContain('checked');
    expect(notes[1]).toContain('Challenge track');
    expect(notes[1]).toContain('Startup');
  });

  it('a template with no conditions behaves exactly as before', async () => {
    const plain: FormField[] = [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'bio', label: 'Bio', type: 'textarea', required: false },
    ];
    const { container, emitted } = render(ContestRegistrationForm, {
      props: { template: plain },
      global: { components: { ContestSubmissionField }, stubs: { i: true } },
    });
    // `name` is required, so a pristine save reports rather than emits.
    await fireEvent.click(saveBtn(container));
    expect(emitted().save).toBeUndefined();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.click(saveBtn(container));
    expect((emitted().save as unknown[][])[0]![0]).toEqual({ name: 'Ada' });
  });

  it('has no axe violations while fields are conditionally shown and hidden', async () => {
    const { container } = mount();
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[1]!);
    await fireEvent.click(container.querySelector('#cpub-reg-is_entity')!);
    const results = await axe.run(container as unknown as Element);
    expect(results.violations).toEqual([]);
  }, 30_000);
});
