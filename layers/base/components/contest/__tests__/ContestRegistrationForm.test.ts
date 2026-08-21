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

  // Save is never disabled by MISSING fields — a greyed button at the foot of a
  // long form is a dead end with no explanation. Incompleteness is reported when
  // the participant asks to save.
  it('Save is enabled on a pristine first registration, missing answers and all', async () => {
    const { container } = mount();
    expect(saveBtn(container).disabled).toBe(false);
  });

  it('an ALL-OPTIONAL form is submittable with nothing filled in', async () => {
    // Every contest created through the editor stores an empty template and falls
    // back to DEFAULT_REGISTRATION_TEMPLATE, whose fields are all optional. This
    // is the page a new arrival lands on straight from "Log in to register", and
    // its only CTA used to be permanently greyed.
    const optional: FormField[] = [
      { key: 'building', label: 'What are you building?', type: 'textarea', required: false },
      { key: 'experience', label: 'Your experience', type: 'radio', required: false, options: [{ value: 'first', label: 'First time' }] },
    ];
    const { container, emitted } = render(ContestRegistrationForm, {
      props: { template: optional, saveLabel: 'Complete registration' },
      global: { components: { ContestSubmissionField }, stubs: { i: true } },
    });
    expect(saveBtn(container).disabled).toBe(false);
    await fireEvent.click(saveBtn(container));
    expect((emitted().save as unknown[][])[0]![0]).toEqual({});
  });

  it('editing already-saved details still requires a change', async () => {
    const { container } = render(ContestRegistrationForm, {
      props: { template: TEMPLATE, savedFields: { name: 'Ada', country: 'us' }, alreadyRegistered: true, saveLabel: 'Save details' },
      global: { components: { ContestSubmissionField }, stubs: { i: true } },
    });
    expect(saveBtn(container).disabled).toBe(true); // nothing to save
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada Lovelace');
    expect(saveBtn(container).disabled).toBe(false);
  });

  it('shows no error on a pristine form, and none for a field never touched', async () => {
    const { container } = mount();
    expect(container.querySelectorAll('.cpub-regform-missing')).toHaveLength(0);
    expect(container.querySelector('#cpub-reg-name')!.getAttribute('aria-invalid')).toBeNull();
  });

  it('reveals a field error once the participant leaves it empty', async () => {
    const { container } = mount();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, '');
    await fireEvent.focusOut(container.querySelector('#cpub-reg-name')!);
    expect(container.querySelector('.cpub-regform-missing')).not.toBeNull();
  });

  it('saving while incomplete does not emit: it reveals every error and lists what is missing', async () => {
    const { container, emitted } = mount();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.click(saveBtn(container));

    expect(emitted().save).toBeUndefined();
    const summary = container.querySelector('.cpub-regform-summary');
    expect(summary).not.toBeNull();
    expect(summary!.getAttribute('role')).toBe('alert');
    expect(summary!.textContent).toContain('One answer is still needed');
    expect(summary!.textContent).toContain('Country');

    // Completing it lets the save through.
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!);
    await fireEvent.click(saveBtn(container));
    expect(emitted().save).toBeDefined();
  });

  it('wires the error to the control: aria-invalid plus aria-describedby pointing at the message', async () => {
    // Pins the id the field component DERIVES against the element this form
    // RENDERS. If the two drift the description points at nothing, silently.
    const { container } = mount();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.click(saveBtn(container));

    const input = container.querySelector('#cpub-reg-name') as HTMLInputElement;
    await fireEvent.update(input, '');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('cpub-reg-name-error');
    expect(container.querySelector(`#${CSS.escape('cpub-reg-name-error')}`)).not.toBeNull();
  });

  it('emits the collected answers on Save (section excluded, empty omitted)', async () => {
    const { container, emitted } = mount();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.click(container.querySelectorAll('input[type=radio]')[0]!);
    await fireEvent.click(saveBtn(container));
    expect(emitted().save?.at(-1)).toEqual([{ name: 'Ada', country: 'us' }]);
  });

  it('prefills from savedFields and stays clean (Save disabled) until edited', async () => {
    const { container } = mount({ savedFields: { name: 'Grace', country: 'ca' }, alreadyRegistered: true });
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

  // Round-2 audit: `focusField` matched `#id` first, but several types put the
  // field id on a <span> label rather than a control, so the lookup found an
  // unfocusable element and the summary link went nowhere. A probe across every
  // type showed the first repair still missed `agreement` and `file`, which is
  // why the resolution is now type-agnostic (focusable id'd element, else the
  // first focusable control in its container) rather than a list of types.
  const EVERY_TYPE: FormField[] = [
    { key: 'lead', label: 'Lead', type: 'text', required: false },
    { key: 't', label: 'T', type: 'text', required: true },
    { key: 'ta', label: 'Ta', type: 'textarea', required: true },
    { key: 'sel', label: 'Sel', type: 'select', required: true, options: [{ value: 'a', label: 'A' }] },
    { key: 'rad', label: 'Rad', type: 'radio', required: true, options: [{ value: 'a', label: 'A' }] },
    { key: 'cb', label: 'Cb', type: 'checkbox', required: true },
    { key: 'dt', label: 'Dt', type: 'date', required: true },
    { key: 'u', label: 'U', type: 'url', required: true },
    { key: 'tel', label: 'Tel', type: 'tel', required: true },
    { key: 'agr', label: 'Agr', type: 'agreement', required: true, terms: 'T' },
    { key: 'addr', label: 'Addr', type: 'address', required: true },
    { key: 'sig', label: 'Sig', type: 'signature', required: true },
    // `file` and `agreement` are the two the first repair still missed.
    { key: 'fl', label: 'Fl', type: 'file', required: true },
  ];

  it.each(EVERY_TYPE.slice(1).map((f) => [f.type, f] as const))(
    'the missing-answers summary moves focus to a real control for a %s field',
    async (_type, field) => {
      const { container } = render(ContestRegistrationForm, {
        props: { template: [EVERY_TYPE[0]!, field] },
        global: { components: { ContestSubmissionField }, stubs: { i: true } },
      });
      await fireEvent.update(container.querySelector('#cpub-reg-lead')!, 'x');
      await fireEvent.click(saveBtn(container));

      const link = container.querySelector('.cpub-regform-summary-link') as HTMLButtonElement;
      expect(link).not.toBeNull();
      await fireEvent.click(link);

      const active = document.activeElement as HTMLElement;
      expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']).toContain(active.tagName);
      expect(active.closest('.cpub-regform-summary')).toBeNull();
    },
  );

  it('the missing-answers summary focuses a RADIO group, whose id sits on a label span', async () => {
    const { container } = mount();
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada');
    await fireEvent.click(saveBtn(container));

    const link = [...container.querySelectorAll('.cpub-regform-summary-link')]
      .find((b) => (b.textContent || '').includes('Country')) as HTMLButtonElement;
    expect(link).toBeDefined();
    await fireEvent.click(link);

    const active = document.activeElement as HTMLElement;
    expect(active).not.toBeNull();
    expect(active.tagName).toBe('INPUT');
    expect((active as HTMLInputElement).type).toBe('radio');
  });

  // Round-2 audit: `savedFields` arrives from a client-only fetch, so it is null
  // through SSR and hydration and then becomes an object. The form is interactive
  // that whole time, and re-seeding on arrival deleted whatever had been typed.
  it('a late savedFields arrival does not wipe what the participant already typed', async () => {
    const { container, rerender } = render(ContestRegistrationForm, {
      props: { template: TEMPLATE, savedFields: null },
      global: { components: { ContestSubmissionField }, stubs: { i: true } },
    });
    await fireEvent.update(container.querySelector('#cpub-reg-name')!, 'Ada Lovelace');

    // The fetch lands with the answers from a previous session.
    await rerender({ savedFields: { name: 'Grace Hopper', country: 'ca' } });

    expect((container.querySelector('#cpub-reg-name') as HTMLInputElement).value).toBe('Ada Lovelace');
  });

  it('still seeds from savedFields when the participant has typed nothing', async () => {
    const { container, rerender } = render(ContestRegistrationForm, {
      props: { template: TEMPLATE, savedFields: null },
      global: { components: { ContestSubmissionField }, stubs: { i: true } },
    });
    expect((container.querySelector('#cpub-reg-name') as HTMLInputElement).value).toBe('');
    await rerender({ savedFields: { name: 'Grace Hopper', country: 'ca' } });
    expect((container.querySelector('#cpub-reg-name') as HTMLInputElement).value).toBe('Grace Hopper');
  });
});
