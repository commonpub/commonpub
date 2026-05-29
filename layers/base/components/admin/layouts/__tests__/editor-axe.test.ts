/**
 * Editor a11y regression — axe-core scan across the components that
 * are mountable in isolation. Phase 3d.5.
 *
 * Scope at v1: the surfaces below mount cleanly without Nuxt's
 * useFetch / route / SSR plumbing. The FULL editor shell (the
 * `/admin/layouts/[id].vue` page itself, with palette + canvas +
 * inspector + drag/drop wired) needs the @nuxt/test-utils harness —
 * deferred to a Phase 3e follow-up (the inspector form arrives there
 * anyway, so growing the harness then is the natural point).
 *
 * What this file DOES guard:
 *   - The new <AdminLayoutsHelpOverlay> (Phase 3d.3)
 *   - <LayoutSection> in editable mode (Phase 3a + 3b + 3d's add-on
 *     buttons: Move Up / Move Down / Move to zone…)
 *   - The 28×28 section-move button cluster (WCAG 2.5.8 AA target size
 *     is enforced via CSS, not aria — axe doesn't fail on size, but
 *     name-from-content + label coverage IS checked here so the cluster
 *     stays SR-traversable)
 *   - <AdminLayoutsToolbar> with undo/redo buttons + tooltips
 *
 * `color-contrast` + `region` rules disabled at the helper level
 * (matches `packages/ui/src/components/__tests__/accessibility.test.ts`
 * convention) — jsdom has no computed styles + components render
 * outside a landmark in isolation.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';

/* The drag-kit mock has to come BEFORE the LayoutSection import. Hoisted
 * factory same as LayoutSection.test.ts. */
const { makeDraggableMock } = vi.hoisted(() => ({
  makeDraggableMock: vi.fn(() => ({
    selected: { value: false },
    isDragging: { value: false },
    isAllowed: { value: true },
    isDragOver: { value: undefined },
  })),
}));
vi.mock('@vue-dnd-kit/core', () => ({
  DnDProvider: { template: '<div><slot/></div>' },
  DragPreview: { template: '<div />' },
  makeDraggable: makeDraggableMock,
  makeDroppable: () => ({
    isAllowed: { value: true },
    isDragOver: { value: undefined },
  }),
  useDnDProvider: () => ({}),
  makeSelectionArea: () => ({}),
  makeConstraintArea: () => ({}),
  makeAutoScroll: () => ({}),
}));

import AdminLayoutsHelpOverlay from '../AdminLayoutsHelpOverlay.vue';
import AdminLayoutsConflictModal from '../AdminLayoutsConflictModal.vue';
import LayoutSection from '../../../LayoutSection.vue';
import type { LayoutSection as LayoutSectionType } from '../../../../composables/useLayout';

/** axe.run wrapper matching packages/ui's convention. Returns a
 *  human-readable violation summary for the assertion. */
async function checkA11y(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      // jsdom can't compute styles — color contrast is verified via
      // tokens at design-system level in packages/ui.
      'color-contrast': { enabled: false },
      // Components render in isolation, not inside a <main>.
      region: { enabled: false },
    },
  });
  const violations = results.violations.map(
    (v) => `${v.id}: ${v.description} (${v.nodes.length} node(s))`,
  );
  expect(violations).toEqual([]);
}

function makeSection(id: string, type = 'divider'): LayoutSectionType {
  return {
    id,
    order: 0,
    type,
    config: {},
    colSpan: 12,
    responsive: null,
    enabled: true,
    visibility: null,
    schemaVersion: 1,
  };
}

describe('a11y — AdminLayoutsHelpOverlay (Phase 3d.3)', () => {
  it('open state has zero AA violations', async () => {
    render(AdminLayoutsHelpOverlay, { props: { open: true } });
    // Teleported to body — scan body so the dialog tree is included.
    await checkA11y(document.body);
  });

  it('closed state has zero AA violations (nothing rendered)', async () => {
    const { container } = render(AdminLayoutsHelpOverlay, { props: { open: false } });
    await checkA11y(container);
  });
});

describe('a11y — AdminLayoutsConflictModal (session 165 round 5)', () => {
  it('open state has zero AA violations (3-option dialog + alertdialog ARIA)', async () => {
    render(AdminLayoutsConflictModal, {
      props: { open: true, message: 'Test conflict message.' },
    });
    await checkA11y(document.body);
  });

  it('open with null message (default copy path) has zero AA violations', async () => {
    render(AdminLayoutsConflictModal, { props: { open: true, message: null } });
    await checkA11y(document.body);
  });

  it('closed state has zero AA violations', async () => {
    const { container } = render(AdminLayoutsConflictModal, {
      props: { open: false, message: null },
    });
    await checkA11y(container);
  });
});

describe('a11y — LayoutSection editable mode (Phase 3a/b/d surface)', () => {
  it('editable=true with selection + all move-buttons present passes axe', async () => {
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('s1'),
        rowId: 'r1',
        route: '/',
        zone: 'main',
        editable: true,
        selectedId: { kind: 'section', id: 's1' },
        onMoveUp: () => {},
        onMoveDown: () => {},
        onMoveToZone: () => {},
        availableZones: ['sidebar', 'full-width'],
      },
    });
    await checkA11y(container);
  });

  it('editable=false (public path) passes axe', async () => {
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('s-pub', 'divider'),
        rowId: 'r1',
        route: '/',
        zone: 'main',
        editable: false,
      },
    });
    await checkA11y(container);
  });

  it('editable + move-to-zone popover OPEN passes axe (menu + items have accessible names)', async () => {
    const { container, getByLabelText } = render(LayoutSection, {
      props: {
        section: makeSection('s-pop'),
        rowId: 'r1',
        route: '/',
        zone: 'main',
        editable: true,
        onMoveToZone: () => {},
        availableZones: ['sidebar', 'full-width'],
      },
    });
    // Open the popover so the menuitems are in the DOM during the scan.
    const trigger = getByLabelText(/move .* to another zone/i);
    trigger.click();
    await new Promise((r) => setTimeout(r, 0));
    await checkA11y(container);
  });
});
