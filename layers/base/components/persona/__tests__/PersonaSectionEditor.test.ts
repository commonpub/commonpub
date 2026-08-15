/**
 * `<PersonaSectionEditor>` — plan 10.2's second row, plus the save contract.
 *
 * Three things here are the difference between a working feature and a quiet
 * data-loss bug:
 *  1. the disclosure is a real button, not a div with role=button containing
 *     buttons (a spec violation this codebase has already shipped once);
 *  2. Save emits one entry per TEMPLATE field, so clearing everything actually
 *     clears it rather than being a no-op the server never hears about;
 *  3. Save is per section and dirty-gated, so a bad URL in Links cannot lose an
 *     unsaved 34-checkbox grid in Interests.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import type { PersonaSection } from '@commonpub/persona';
import { BUILTIN_PERSONA_LINK_PLATFORMS } from '@commonpub/persona';
import SectionEditor from '../PersonaSectionEditor.vue';

const INTERESTS: PersonaSection = {
  key: 'interests',
  label: 'Interests',
  help: 'Pick whatever you want people to see.',
  fields: [
    {
      key: 'interests',
      label: 'What are you into?',
      type: 'multiselect',
      options: [
        { value: 'hardware', label: 'Hardware' },
        { value: 'software', label: 'Software' },
        { value: 'robotics', label: 'Robotics' },
      ],
    },
  ],
};

const BASICS: PersonaSection = {
  key: 'basics',
  label: 'Basics',
  fields: [
    { key: 'headline', label: 'Job title', type: 'text', maxLength: 255 },
    { key: 'hd', label: 'More', type: 'section' },
    { key: 'site', label: 'Website', type: 'url' },
  ],
};

const LINKS: PersonaSection = {
  key: 'links',
  label: 'Links',
  fields: [{ key: 'link_github', label: 'GitHub', type: 'link', platform: 'github' }],
};

interface MountProps {
  section?: PersonaSection;
  values?: Record<string, string | string[]>;
  index?: number;
  saving?: boolean;
  error?: string | null;
  open?: boolean;
}

function mount(props: MountProps = {}) {
  return render(SectionEditor, {
    props: {
      section: INTERESTS,
      values: {},
      platforms: BUILTIN_PERSONA_LINK_PLATFORMS,
      index: 0,
      ...props,
    },
  });
}

describe('PersonaSectionEditor — the disclosure', () => {
  it('is a real <button> carrying aria-expanded and aria-controls', () => {
    const { getByRole } = mount();
    const toggle = getByRole('button', { name: /^Interests/ });
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).not.toBeNull();
  });

  it('is not a div with role=button, and no button is nested inside another', () => {
    const { container } = mount();
    expect(container.querySelector('div[role="button"]')).toBeNull();
    for (const btn of container.querySelectorAll('button')) {
      expect(btn.querySelector('button')).toBeNull();
    }
  });

  it('is not <details>, because the state has to be drivable from outside', () => {
    const { container } = mount();
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('toggling flips aria-expanded and hides the region without removing it', async () => {
    const { getByRole } = mount();
    const toggle = getByRole('button', { name: /^Interests/ });
    const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(region.hasAttribute('hidden')).toBe(false);

    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // Still in the DOM: aria-controls must always resolve, and a deep link has
    // to be able to open it without a re-render race.
    expect(document.getElementById(region.id)).not.toBeNull();
    expect(region.hasAttribute('hidden')).toBe(true);
  });
});

describe('PersonaSectionEditor — open defaults', () => {
  it.each([0, 1])('section at index %i starts open', (index) => {
    const { getByRole } = mount({ index });
    expect(getByRole('button', { name: /^Interests/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('the third and later start closed', () => {
    const { getByRole } = mount({ index: 2 });
    expect(getByRole('button', { name: /^Interests/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('collapsedByDefault beats position', () => {
    const { getByRole } = mount({ section: { ...INTERESTS, collapsedByDefault: true }, index: 0 });
    expect(getByRole('button', { name: /^Interests/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('a bound open prop wins, so a page can deep-link a section', async () => {
    const { getByRole, emitted } = mount({ index: 5, open: true });
    const toggle = getByRole('button', { name: /^Interests/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(toggle);
    expect((emitted('update:open') as Array<[boolean]>).at(-1)?.[0]).toBe(false);
  });
});

describe('PersonaSectionEditor — save is per section, dirty-gated, explicit', () => {
  function saveButton(getByRole: ReturnType<typeof mount>['getByRole']): HTMLButtonElement {
    return getByRole('button', { name: /Save Interests/ }) as HTMLButtonElement;
  }

  it('Save is disabled until something changes', async () => {
    const { getByRole, container } = mount({ values: { interests: ['hardware'] } });
    expect(saveButton(getByRole).disabled).toBe(true);

    const boxes = container.querySelectorAll('input[type="checkbox"]');
    await fireEvent.click(boxes[1] as HTMLInputElement);
    expect(saveButton(getByRole).disabled).toBe(false);
  });

  it('never autosaves: changing a value emits nothing until Save is pressed', async () => {
    const { container, emitted, getByRole } = mount();
    await fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement);
    expect(emitted('save')).toBeUndefined();
    await fireEvent.click(saveButton(getByRole));
    expect(emitted('save')).toBeDefined();
  });

  it('emits one entry per TEMPLATE field, so clearing everything really clears it', async () => {
    const { container, emitted, getByRole } = mount({ values: { interests: ['hardware'] } });
    // Uncheck the only selection.
    await fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement);
    await fireEvent.click(saveButton(getByRole));

    const [payload] = (emitted('save') as Array<[{ sectionKey: string; answers: Record<string, unknown> }]>)[0]!;
    expect(payload.sectionKey).toBe('interests');
    // The key is PRESENT with an empty array. Omitting it would make "uncheck
    // everything" a silent no-op against the server's template-scoped delete.
    expect(Object.keys(payload.answers)).toEqual(['interests']);
    expect(payload.answers.interests).toEqual([]);
  });

  it('carries every answerable field of the section and no layout field', async () => {
    const { getByLabelText, emitted, getByRole } = render(SectionEditor, {
      props: { section: BASICS, values: {}, platforms: BUILTIN_PERSONA_LINK_PLATFORMS, index: 0 },
    });
    await fireEvent.update(getByLabelText('Job title'), 'Firmware engineer');
    await fireEvent.click(getByRole('button', { name: /Save Basics/ }));

    const [payload] = (emitted('save') as Array<[{ answers: Record<string, unknown> }]>)[0]!;
    expect(Object.keys(payload.answers).sort()).toEqual(['headline', 'site']);
    expect(payload.answers.headline).toBe('Firmware engineer');
    // A `section` field is layout. It is rendered, never saved.
    expect(payload.answers).not.toHaveProperty('hd');
  });

  it('Discard puts the draft back and re-disables Save', async () => {
    const { container, getByRole, getByText } = mount({ values: { interests: ['hardware'] } });
    await fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement);
    await fireEvent.click(getByText('Discard changes'));
    expect(saveButton(getByRole).disabled).toBe(true);
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false]);
  });

  it('an invalid link blocks the save for ITS OWN section and says so', async () => {
    const { getByLabelText, getByRole, getByText } = render(SectionEditor, {
      props: { section: LINKS, values: {}, platforms: BUILTIN_PERSONA_LINK_PLATFORMS, index: 0 },
    });
    await fireEvent.update(getByLabelText('GitHub'), 'https://evilgithub.com/ada');
    expect((getByRole('button', { name: /Save Links/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByText('Fix the highlighted answer before saving.')).toBeTruthy();

    await fireEvent.update(getByLabelText('GitHub'), 'https://github.com/ada');
    expect((getByRole('button', { name: /Save Links/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('validates a link against the built-ins even when no platforms prop is passed', async () => {
    // The seam with pages/settings/persona.vue, which does not pass :platforms.
    // An omitted prop must never weaken a check: without the built-in union
    // here, `https://evilgithub.com/ada` would sail through as "a valid URL".
    const { getByLabelText, getByRole } = render(SectionEditor, {
      props: { section: LINKS, values: {}, index: 0 },
    });
    await fireEvent.update(getByLabelText('GitHub'), 'https://evilgithub.com/ada');
    expect((getByRole('button', { name: /Save Links/ }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.update(getByLabelText('GitHub'), 'https://github.com/ada');
    expect((getByRole('button', { name: /Save Links/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a server error for this section is shown next to that section save button', () => {
    const { getByRole } = mount({ error: 'That link is not allowed.' });
    expect(getByRole('alert').textContent).toContain('That link is not allowed.');
  });

  it('while saving, the controls are disabled and the button says so', () => {
    const { container, getByRole } = mount({ saving: true });
    expect(getByRole('button', { name: /Saving/ })).toBeTruthy();
    expect([...container.querySelectorAll('input')].every((i) => (i as HTMLInputElement).disabled)).toBe(true);
  });
});

describe('PersonaSectionEditor — seeding', () => {
  it('renders saved values on the very first paint, with no watcher round trip', () => {
    // Seeding inside watch(..., { immediate: true }) is the documented SSR
    // hydration-mismatch pattern; this seeds synchronously in setup instead.
    const { container } = mount({ values: { interests: ['hardware', 'robotics'] } });
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([true, false, true]);
  });

  it('re-seeds when the saved values change, which is what a successful save does', async () => {
    const { container, rerender } = mount({ values: {} });
    await rerender({ values: { interests: ['software'] } });
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it('tolerates a scalar arriving where a set is expected, and the reverse', () => {
    const set = mount({ values: { interests: 'hardware' } });
    expect(((set.container.querySelectorAll('input[type="checkbox"]')[0]) as HTMLInputElement).checked).toBe(true);

    const scalar = render(SectionEditor, {
      props: { section: BASICS, values: { headline: ['Firmware engineer'] }, platforms: [], index: 0 },
    });
    expect((scalar.getByLabelText('Job title') as HTMLInputElement).value).toBe('Firmware engineer');
  });
});

describe('PersonaSectionEditor — accessibility', () => {
  it.each([['open', 0], ['closed', 2]] as const)('has no axe violations when %s', async (_name, index) => {
    const { container } = mount({ index, values: { interests: ['hardware'] } });
    const results = await axe.run(container, {
      rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it('the toggle sits inside a heading so the section appears in the outline', () => {
    const { container } = mount();
    const heading = container.querySelector('h1,h2,h3,h4,h5,h6');
    expect(heading).not.toBeNull();
    expect(heading?.querySelector('button')).not.toBeNull();
  });
});
