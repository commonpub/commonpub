/**
 * Phase 3e — section/row config inspector tests.
 *
 * Three surfaces:
 *   - <AdminLayoutsAutoForm>: the recursive native-input renderer. Tested
 *     directly (renders controls, emits fresh config objects on edit,
 *     array add/remove, numeric-select coercion).
 *   - <AdminLayoutsInspectorSection>: registry lookup + Zod validation
 *     surfacing + the edge states (unknown type, empty schema, drift).
 *   - <AdminLayoutsInspectorRow>: dogfoods the same engine on the row schema.
 *
 * The registry is mocked so we don't drag the builtin `.vue` import graph
 * into these tests; the ENGINE itself is exhaustively table-tested against
 * the real schemas in `composables/__tests__/autoFormSchema.test.ts`.
 *
 * Recursion: AutoForm self-references by `name`. When a DIFFERENT component
 * (the inspectors) embeds it, we register it via `global.components` since
 * vitest has no Nuxt auto-import.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import {
  heroConfigSchema,
  headingConfigSchema,
  statsConfigSchema,
  layoutRowConfigSchema,
} from '@commonpub/schema';

// Mock the registry BEFORE importing the inspector (hoisted).
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../../../../sections/registry', () => ({
  useSectionRegistry: () => ({ get: getMock }),
}));

import AdminLayoutsAutoForm from '../AdminLayoutsAutoForm.vue';
import AdminLayoutsInspectorSection from '../AdminLayoutsInspectorSection.vue';
import AdminLayoutsInspectorRow from '../AdminLayoutsInspectorRow.vue';
import { buildAutoForm } from '../../../../composables/autoFormSchema';
import type { LayoutSectionResolved, LayoutRowResolved } from '@commonpub/server';

/** Last emission's first arg, typed. vue-tsc strict won't let you index
 *  `unknown` straight off emitted() (feedback-vue-tsc-strict-vs-vitest). */
function lastArg(calls: unknown[] | undefined): Record<string, unknown> {
  const list = (calls ?? []) as unknown[][];
  return (list[list.length - 1]?.[0] ?? {}) as Record<string, unknown>;
}

function sectionFixture(over: Partial<LayoutSectionResolved> = {}): LayoutSectionResolved {
  return {
    id: 's1',
    order: 0,
    type: 'heading',
    config: { level: 2, text: 'Hello' },
    colSpan: 12,
    responsive: null,
    enabled: true,
    visibility: null,
    schemaVersion: 1,
    ...over,
  };
}

describe('AdminLayoutsAutoForm — controlled rendering + emits', () => {
  it('renders a text input + select + emits a fresh config on edit (heading)', async () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    const { getByLabelText, emitted } = render(AdminLayoutsAutoForm, {
      props: { fields, modelValue: { level: 2, text: 'Hello' } },
    });

    const text = getByLabelText('Text') as HTMLInputElement;
    expect(text.value).toBe('Hello');
    await fireEvent.update(text, 'World');
    const ev = emitted()['update:modelValue'];
    expect(ev).toBeTruthy();
    // Emits a NEW object (immutable update), text replaced, level preserved.
    expect(ev!.at(-1)).toEqual([{ level: 2, text: 'World' }]);
  });

  it('reflects the current value in a select on render (heading.level=3)', () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    const { getByLabelText } = render(AdminLayoutsAutoForm, {
      props: { fields, modelValue: { level: 3, text: 'Hi' } },
    });
    expect((getByLabelText('Level') as HTMLSelectElement).value).toBe('3');
  });

  it('optional select (row gap, no default) shows a leading "Default" option + undefined value selects it', () => {
    const { fields } = buildAutoForm(layoutRowConfigSchema);
    const { getByLabelText, emitted } = render(AdminLayoutsAutoForm, {
      props: { fields, modelValue: {} }, // fresh row — no gap set
    });
    const gap = getByLabelText('Gap') as HTMLSelectElement;
    // undefined value → the leading empty "— Default —" option is selected,
    // NOT the first real enum value ('none').
    expect(gap.value).toBe('');
    // Picking a real value emits it; picking back the default clears the key.
    fireEvent.update(gap, 'lg');
    expect((emitted()['update:modelValue']!.at(-1) as unknown[])[0]).toMatchObject({ gap: 'lg' });
  });

  it('clearing an optional select back to Default emits undefined (key dropped on save)', async () => {
    const { fields } = buildAutoForm(layoutRowConfigSchema);
    const { getByLabelText, emitted } = render(AdminLayoutsAutoForm, {
      props: { fields, modelValue: { gap: 'lg' } },
    });
    await fireEvent.update(getByLabelText('Gap') as HTMLSelectElement, '');
    const payload = (emitted()['update:modelValue']!.at(-1) as unknown[])[0] as Record<string, unknown>;
    expect(payload.gap).toBeUndefined();
  });

  it('coerces numeric-const selects back to numbers (heading.level)', async () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    const { getByLabelText, emitted } = render(AdminLayoutsAutoForm, {
      props: { fields, modelValue: { level: 2, text: 'Hi' } },
    });
    const level = getByLabelText('Level') as HTMLSelectElement;
    await fireEvent.update(level, '3');
    const payload = lastArg(emitted()['update:modelValue']);
    expect(payload.level).toBe(3); // number, not "3"
    expect(typeof payload.level).toBe('number');
  });

  it('array repeater: add appends the blank item default, remove drops it (hero.ctas)', async () => {
    const { fields } = buildAutoForm(heroConfigSchema);
    const { getByText, getByLabelText, emitted, rerender } = render(AdminLayoutsAutoForm, {
      props: { fields, modelValue: { variant: 'default', customTitle: '', customSubtitle: '', ctas: [] } },
    });

    await fireEvent.click(getByText(/add cta/i));
    const afterAdd = lastArg(emitted()['update:modelValue']);
    expect(afterAdd.ctas).toEqual([{ label: '', href: '', variant: 'primary' }]);

    // Feed the added item back in, then remove it. The remove button is
    // icon-only — its accessible name comes from aria-label ("Remove ctas 1").
    await rerender({ fields, modelValue: afterAdd });
    await fireEvent.click(getByLabelText(/remove ctas 1/i));
    const afterRemove = lastArg(emitted()['update:modelValue']);
    expect(afterRemove.ctas).toEqual([]);
  });

  it('disables Add when maxItems reached (hero.ctas max 2)', () => {
    const { fields } = buildAutoForm(heroConfigSchema);
    const { getByText } = render(AdminLayoutsAutoForm, {
      props: {
        fields,
        modelValue: {
          variant: 'default', customTitle: '', customSubtitle: '',
          ctas: [{ label: 'A', href: '/a', variant: 'primary' }, { label: 'B', href: '/b', variant: 'primary' }],
        },
      },
    });
    const addBtn = getByText(/add cta/i).closest('button') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });
});

describe('AdminLayoutsInspectorSection — dispatch + validation + edges', () => {
  it('renders the section name + auto-form for a registered type', () => {
    getMock.mockReturnValue({
      type: 'heading', name: 'Heading', icon: 'fa-heading',
      configSchema: headingConfigSchema, schemaVersion: 1,
    });
    const { getByText, getByLabelText } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture() },
      global: { components: { AdminLayoutsAutoForm } },
    });
    expect(getByText('Heading')).toBeTruthy();
    expect(getByLabelText('Text')).toBeTruthy();
  });

  it('surfaces a Zod validation error inline (heading.text min(1))', () => {
    getMock.mockReturnValue({
      type: 'heading', name: 'Heading', icon: 'fa-heading',
      configSchema: headingConfigSchema, schemaVersion: 1,
    });
    const { container } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture({ config: { level: 2, text: '' } }) },
      global: { components: { AdminLayoutsAutoForm } },
    });
    // text='' violates .min(1) → an inline role=alert error renders.
    const err = container.querySelector('.cpub-autoform-error');
    expect(err).toBeTruthy();
  });

  it('shows an error card for an unregistered section type', () => {
    getMock.mockReturnValue(null);
    const { getByText } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture({ type: 'ghost-type' }) },
      global: { components: { AdminLayoutsAutoForm } },
    });
    expect(getByText(/unknown section type/i)).toBeTruthy();
  });

  it('shows the "no options" note for an empty schema (stats)', () => {
    getMock.mockReturnValue({
      type: 'stats', name: 'Stats', icon: 'fa-chart-simple',
      configSchema: statsConfigSchema, schemaVersion: 1,
    });
    const { getByText } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture({ type: 'stats', config: {} }) },
      global: { components: { AdminLayoutsAutoForm } },
    });
    expect(getByText(/no configurable options/i)).toBeTruthy();
  });

  it('shows a schema-version drift advisory when versions differ', () => {
    getMock.mockReturnValue({
      type: 'heading', name: 'Heading', icon: 'fa-heading',
      configSchema: headingConfigSchema, schemaVersion: 3,
    });
    const { getByText } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture({ schemaVersion: 1 }) },
      global: { components: { AdminLayoutsAutoForm } },
    });
    expect(getByText(/schema v1/i)).toBeTruthy();
  });

  it('emits update:config when the form edits (forwarded from AutoForm)', async () => {
    getMock.mockReturnValue({
      type: 'heading', name: 'Heading', icon: 'fa-heading',
      configSchema: headingConfigSchema, schemaVersion: 1,
    });
    const { getByLabelText, emitted } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture() },
      global: { components: { AdminLayoutsAutoForm } },
    });
    await fireEvent.update(getByLabelText('Text'), 'Changed');
    const ev = emitted()['update:config'];
    expect(ev).toBeTruthy();
    expect(lastArg(ev).text).toBe('Changed');
  });
});

describe('AdminLayoutsInspectorRow — row config via the shared engine', () => {
  function rowFixture(over: Partial<LayoutRowResolved> = {}): LayoutRowResolved {
    return { id: 'r1', order: 0, config: null, sections: [], ...over };
  }

  it('renders gap/align/background/paddingY controls from layoutRowConfigSchema', () => {
    const { getByLabelText } = render(AdminLayoutsInspectorRow, {
      props: { row: rowFixture() },
      global: { components: { AdminLayoutsAutoForm } },
    });
    expect(getByLabelText('Gap')).toBeTruthy();
    expect(getByLabelText('Align')).toBeTruthy();
    expect(getByLabelText('Background')).toBeTruthy();
    expect(getByLabelText('Padding y')).toBeTruthy();
  });

  it('emits update:config on edit', async () => {
    const { getByLabelText, emitted } = render(AdminLayoutsInspectorRow, {
      props: { row: rowFixture({ config: { gap: 'md' } }) },
      global: { components: { AdminLayoutsAutoForm } },
    });
    await fireEvent.update(getByLabelText('Gap'), 'lg');
    const ev = emitted()['update:config'];
    expect(ev).toBeTruthy();
    expect(lastArg(ev).gap).toBe('lg');
  });
});

/**
 * axe regression — the new editable inspector surfaces. Cheapest insurance
 * per feedback-aria-selected-needs-role: any new editable component gets an
 * axe scan so ARIA regressions are caught at the boundary. color-contrast +
 * region disabled (jsdom has no computed styles; components render outside a
 * landmark) — matches editor-axe.test.ts convention.
 */
async function checkA11y(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
}

describe('a11y — Phase 3e inspector surfaces', () => {
  it('AutoForm with every control kind (hero: enum/text/array<object>) passes axe', async () => {
    const { fields } = buildAutoForm(heroConfigSchema);
    const { container } = render(AdminLayoutsAutoForm, {
      props: {
        fields,
        modelValue: {
          variant: 'default', customTitle: 'Hi', customSubtitle: 'Sub',
          ctas: [{ label: 'Go', href: '/go', variant: 'primary' }],
        },
      },
    });
    await checkA11y(container);
  });

  it('AutoForm surfacing an inline error (aria-invalid + role=alert) passes axe', async () => {
    const { fields } = buildAutoForm(headingConfigSchema);
    const { container } = render(AdminLayoutsAutoForm, {
      props: {
        fields,
        modelValue: { level: 2, text: '' },
        errors: { text: 'String must contain at least 1 character(s)' },
      },
    });
    await checkA11y(container);
  });

  it('InspectorSection (registered type, full form) passes axe', async () => {
    getMock.mockReturnValue({
      type: 'heading', name: 'Heading', icon: 'fa-heading',
      configSchema: headingConfigSchema, schemaVersion: 1,
    });
    const { container } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture() },
      global: { components: { AdminLayoutsAutoForm } },
    });
    await checkA11y(container);
  });

  it('InspectorSection unknown-type error card passes axe', async () => {
    getMock.mockReturnValue(null);
    const { container } = render(AdminLayoutsInspectorSection, {
      props: { section: sectionFixture({ type: 'ghost' }) },
      global: { components: { AdminLayoutsAutoForm } },
    });
    await checkA11y(container);
  });

  it('InspectorRow passes axe', async () => {
    const { container } = render(AdminLayoutsInspectorRow, {
      props: { row: { id: 'r1', order: 0, config: null, sections: [] } },
      global: { components: { AdminLayoutsAutoForm } },
    });
    await checkA11y(container);
  });
});
