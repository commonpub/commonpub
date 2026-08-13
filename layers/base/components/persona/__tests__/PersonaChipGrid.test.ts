/**
 * `<PersonaChipGrid>` — plan 10.2's first row.
 *
 * The chip grid is the surface the whole feature is judged on: it is the densest
 * control on the page, it is the one people fill in on a phone, and every
 * shortcut available here (divs with `aria-selected`, a colour-only selected
 * state, a click that silently does nothing at the cap) is a shortcut that
 * degrades quietly rather than breaking loudly. Each of those is pinned below.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import type { PersonaField } from '@commonpub/persona';
import ChipGrid from '../PersonaChipGrid.vue';

const FIELD: PersonaField = {
  key: 'interests',
  label: 'What are you into?',
  type: 'multiselect',
  help: 'Pick as many as you like.',
  options: [
    { value: 'hardware', label: 'Hardware' },
    { value: 'software', label: 'Software' },
    { value: 'robotics', label: 'Robotics' },
    { value: 'pcb', label: 'PCB design' },
    { value: 'iot', label: 'IoT' },
    { value: 'security', label: 'Security' },
  ],
};

function mount(props: Partial<{ field: PersonaField; modelValue: string[] }> = {}) {
  return render(ChipGrid, {
    props: { field: FIELD, modelValue: [], ...props },
  });
}

describe('PersonaChipGrid — structure', () => {
  it('is a fieldset with a legend holding real checkboxes', () => {
    const { container, getByRole } = mount();
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.querySelector('legend')?.textContent).toContain('What are you into?');
    // role=group is stated explicitly, not merely implied by <fieldset>.
    expect(fieldset?.getAttribute('role')).toBe('group');
    expect(getByRole('group')).toBe(fieldset);

    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBe(FIELD.options?.length);
  });

  it('uses the token-driven grid class, not a hand-rolled flex wrap', () => {
    const { container } = mount();
    expect(container.querySelector('.cpub-chip-grid')).not.toBeNull();
  });

  it('never uses role=listbox or aria-selected', () => {
    // aria-selected is only valid on option/tab/row/gridcell/treeitem/columnheader.
    // On a chip it would be announced by nothing at all.
    const { container } = mount({ modelValue: ['hardware'] });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(container.querySelector('[aria-selected]')).toBeNull();
  });

  it('marks selection three ways, so it is never colour-only', () => {
    const { container } = mount({ modelValue: ['software'] });
    const chips = [...container.querySelectorAll('.cpub-chip')];
    const selected = chips.find((c) => c.textContent?.includes('Software'));
    // 1: the class carrying the border + background tokens.
    expect(selected?.classList.contains('cpub-chip--selected')).toBe(true);
    // 2 and 3: the checkbox itself is present, visible and checked.
    const box = selected?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.type).toBe('checkbox');
  });

  it('wires help text to the group with aria-describedby', () => {
    const { container, getByText } = mount();
    const help = getByText('Pick as many as you like.');
    const described = container.querySelector('fieldset')?.getAttribute('aria-describedby') ?? '';
    expect(described.split(' ')).toContain(help.id);
  });
});

describe('PersonaChipGrid — selection', () => {
  // NOTE: fireEvent.update on a checkbox ALWAYS sets checked=true (see
  // @testing-library/vue's fire-event.js), so it can never express an uncheck.
  // Clicking is both the honest gesture and the only one that can fail.
  it('checking a box emits the new set without mutating the old one', async () => {
    const original = ['hardware'];
    const { container, emitted } = mount({ modelValue: original });
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    await fireEvent.click(boxes[1] as HTMLInputElement);

    const events = emitted('update:modelValue') as Array<[string[]]>;
    expect(events.at(-1)?.[0]).toEqual(['hardware', 'software']);
    // The caller's baseline array must survive, or dirty-tracking has nothing
    // to compare against.
    expect(original).toEqual(['hardware']);
  });

  it('unchecking removes just that value', async () => {
    const { container, emitted } = mount({ modelValue: ['hardware', 'software'] });
    const box = container.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement;
    await fireEvent.click(box);
    const events = emitted('update:modelValue') as Array<[string[]]>;
    expect(events.at(-1)?.[0]).toEqual(['software']);
  });

  it('emits in option order, not click order', async () => {
    const { container, emitted } = mount({ modelValue: ['robotics'] });
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    await fireEvent.click(boxes[0] as HTMLInputElement);
    const events = emitted('update:modelValue') as Array<[string[]]>;
    expect(events.at(-1)?.[0]).toEqual(['hardware', 'robotics']);
  });
});

describe('PersonaChipGrid — maxSelections', () => {
  const capped: PersonaField = { ...FIELD, maxSelections: 2 };

  it('below the cap, nothing is disabled and the count is announced', () => {
    const { container, getByRole } = render(ChipGrid, {
      props: { field: capped, modelValue: ['hardware'] },
    });
    expect(container.querySelectorAll('input[type="checkbox"]:disabled').length).toBe(0);
    expect(getByRole('status').textContent).toContain('1 of 2 selected.');
  });

  it('at the cap, unchecked boxes are disabled and checked ones are not', () => {
    const { container } = render(ChipGrid, {
      props: { field: capped, modelValue: ['hardware', 'software'] },
    });
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    // Checked chips must stay operable, or the cap becomes a trap you cannot
    // back out of.
    expect(boxes[0]!.disabled).toBe(false);
    expect(boxes[1]!.disabled).toBe(false);
    expect(boxes.slice(2).every((b) => b.disabled)).toBe(true);
  });

  it('announces the cap politely with the exact copy', () => {
    const { getByRole } = render(ChipGrid, {
      props: { field: { ...FIELD, maxSelections: 5 }, modelValue: ['hardware', 'software', 'robotics', 'pcb', 'iot'] },
    });
    const status = getByRole('status');
    expect(status.textContent).toBe('5 of 5 selected. Clear one to choose another.');
    // Polite, never assertive: role=status carries the implicit polite region,
    // and an explicit assertive one would interrupt mid-sentence for a checkbox.
    expect(status.getAttribute('aria-live')).not.toBe('assertive');
  });

  it('keeps the live region in the DOM before it has anything to say', () => {
    // A live region created in the same tick as its text is dropped by several
    // screen readers, so the element must pre-exist the announcement.
    const { getByRole } = render(ChipGrid, { props: { field: capped, modelValue: [] } });
    expect(getByRole('status')).not.toBeNull();
  });

  it('an uncapped field never disables and never claims a cap', () => {
    const { container, getByRole } = mount({ modelValue: ['hardware', 'software'] });
    expect(container.querySelectorAll('input:disabled').length).toBe(0);
    expect(getByRole('status').textContent).toBe('2 selected.');
  });
});

describe('PersonaChipGrid — accessibility', () => {
  it('has no axe violations, selected or not', async () => {
    for (const modelValue of [[], ['hardware', 'software']]) {
      const { container } = mount({ modelValue });
      const results = await axe.run(container, {
        // Page-level rules do not apply to a mounted fragment.
        rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
      });
      expect(results.violations).toEqual([]);
    }
  });

  it('every chip is a label wrapping its own input, so the whole chip is the target', () => {
    const { container } = mount();
    const chips = [...container.querySelectorAll('.cpub-chip')];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.tagName).toBe('LABEL');
      expect(chip.querySelector('input[type="checkbox"]')).not.toBeNull();
    }
  });
});
