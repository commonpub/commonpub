/**
 * Tests for <LayoutSlot> — the zone renderer that <pages/index.vue> and
 * <pages/[...customPath].vue> use to render layout-engine output.
 *
 * Phase 3a.1 adds an `editable?: boolean` prop. When true, the row + section
 * wrappers get `--editable` modifier classes that paint a dashed hover
 * outline + a small type-label badge. NO event handlers / selection state /
 * keyboard model in 3a.1 — those arrive in 3a.3 + 3d. Public render paths
 * (which never pass the flag) MUST be byte-pattern unchanged.
 *
 * The tests below feed a static layout via `previewOverride` to bypass
 * the network — useLayout is still called, so we stub it to return
 * null + pending=false (the previewOverride path takes over the render).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, computed } from 'vue';

/**
 * Mock @vue-dnd-kit/core BEFORE importing components — makeDroppable
 * (called inside LayoutRow.vue during setup) throws "DnD provider not
 * found" without a DnDProvider ancestor. We replace it with stubs that
 * return inert reactive values. Tests that need to assert call args
 * use `vi.mocked(makeDroppable).mock.calls` (see LayoutRow.test.ts).
 *
 * This pattern is local to test files that mount components touching
 * the editor surface — public-path tests (which never instantiate
 * LayoutRow with editable=true) don't need the mock, but the mock is
 * cheap + makes the file robust to refactors.
 */
vi.mock('@vue-dnd-kit/core', () => ({
  DnDProvider: { template: '<div><slot/></div>' },
  DragPreview: { template: '<div />' },
  makeDraggable: () => ({
    selected: ref(false),
    isDragging: computed(() => false),
    isAllowed: computed(() => true),
    isDragOver: computed(() => undefined),
  }),
  makeDroppable: () => ({
    isAllowed: computed(() => true),
    isDragOver: computed(() => undefined),
  }),
  useDnDProvider: () => ({}),
  makeSelectionArea: () => ({}),
  makeConstraintArea: () => ({}),
  makeAutoScroll: () => ({}),
}));

import LayoutSlot from '../LayoutSlot.vue';
import type { LayoutPayload } from '../../composables/useLayout';
import type { EditorSelection } from '../../composables/useLayoutEditor';

/* ---- Composable stubs ---- */

function setupComposables(featureFlags: Record<string, boolean> = {}): void {
  const g = globalThis as Record<string, unknown>;
  g.useLayout = () => ({
    layout: ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: () => Promise.resolve(),
  });
  g.useFeatures = () => ({
    features: ref({ admin: true, layoutEngine: true, ...featureFlags }),
  });
  g.useAuth = () => ({
    isAuthenticated: ref(false),
    user: ref(null),
  });
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.useLayout;
  delete g.useFeatures;
  delete g.useAuth;
});

/* ---- Fixtures ---- */

/** Minimal layout payload — one row in `main` zone, one `divider` section.
 *  `divider` is registered in layers/base/sections/builtin/divider.ts and
 *  is the simplest section to render in tests. */
function makeLayout(): LayoutPayload {
  return {
    state: 'published',
    pageMeta: null,
    zones: [
      {
        zone: 'main',
        rows: [
          {
            id: 'row-1',
            order: 0,
            config: { gap: 'md' },
            sections: [
              {
                id: 'sec-1',
                order: 0,
                type: 'divider',
                config: {},
                colSpan: 12,
                responsive: null,
                enabled: true,
                visibility: null,
                schemaVersion: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

function mount(props: {
  editable?: boolean;
  onSelect?: (sel: EditorSelection) => void;
  selectedId?: EditorSelection | null;
}) {
  return render(LayoutSlot, {
    props: {
      route: '/test',
      zone: 'main',
      previewOverride: makeLayout(),
      ...props,
    },
  });
}

/* ---- Tests ---- */

describe('LayoutSlot — render path (regression-guard)', () => {
  it('renders the row + section wrapper for the given zone', () => {
    setupComposables();
    const { container } = mount({});
    expect(container.querySelector('.cpub-layout-row')).not.toBeNull();
    expect(container.querySelector('.cpub-layout-section')).not.toBeNull();
    expect(container.querySelector('[data-section-id="sec-1"]')).not.toBeNull();
    expect(container.querySelector('[data-section-type="divider"]')).not.toBeNull();
  });
});

describe('LayoutSlot — :editable prop', () => {
  it('default (editable=false) does NOT add --editable classes (public-mode pristine)', () => {
    // This is the load-bearing test: the public homepage path must be
    // byte-pattern unchanged. Any leak of `--editable` into commonpub.io's
    // public HTML is a regression.
    setupComposables();
    const { container } = mount({});
    expect(container.querySelector('.cpub-layout-row--editable')).toBeNull();
    expect(container.querySelector('.cpub-layout-section--editable')).toBeNull();
  });

  it('editable=true applies --editable classes to row + section wrappers', () => {
    setupComposables();
    const { container } = mount({ editable: true });
    expect(container.querySelector('.cpub-layout-row--editable')).not.toBeNull();
    expect(container.querySelector('.cpub-layout-section--editable')).not.toBeNull();
  });

  it('editable=true preserves data-section-id + data-section-type (no semantic drift)', () => {
    // Mode change must NOT alter data attributes that downstream tooling
    // (selectors, accessibility scanners, future click handlers in 3a.3)
    // rely on to identify sections.
    setupComposables();
    const { container } = mount({ editable: true });
    const section = container.querySelector('.cpub-layout-section--editable');
    expect(section?.getAttribute('data-section-id')).toBe('sec-1');
    expect(section?.getAttribute('data-section-type')).toBe('divider');
  });

  it('editable=true adds tabindex=0 + aria-selected + aria-label (3b/A selection chrome, NO role=button)', () => {
    // 3b/A cashes the reservation 3a.1 made: now there IS a selection
    // model behind the affordance. R2/R1-1 audit (this session) dropped
    // role='button' because Move Up/Down buttons live inside the section
    // → nested role='button' is an ARIA violation. aria-selected
    // expresses the same selectable semantic without the violation.
    setupComposables();
    const { container } = mount({ editable: true });
    const section = container.querySelector('.cpub-layout-section--editable');
    expect(section?.getAttribute('tabindex')).toBe('0');
    expect(section?.getAttribute('role')).toBeNull();
    expect(section?.getAttribute('aria-label')).toBe('Select divider section');
    expect(section?.getAttribute('aria-selected')).toBe('false');
  });

  it('editable=false keeps section tabindex / aria attrs unset (public path pristine)', () => {
    // The load-bearing byte-pattern test: commonpub.io's homepage path
    // MUST NOT light up selection a11y attributes when no editor is in
    // scope. Mirrors the existing --editable class regression-guard.
    setupComposables();
    const { container } = mount({});
    const section = container.querySelector('.cpub-layout-section');
    expect(section?.getAttribute('tabindex')).toBeNull();
    expect(section?.getAttribute('role')).toBeNull();
    expect(section?.getAttribute('aria-selected')).toBeNull();
    expect(section?.getAttribute('aria-label')).toBeNull();
  });
});

describe('LayoutSlot — selection (Phase 3b/A)', () => {
  it('clicking a section calls onSelect({kind:"section", id})', async () => {
    setupComposables();
    const onSelect = vi.fn();
    const { container } = mount({ editable: true, onSelect });
    const section = container.querySelector('[data-section-id="sec-1"]') as HTMLElement;
    await fireEvent.click(section);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ kind: 'section', id: 'sec-1' });
  });

  it('Enter on a focused section activates selection', async () => {
    setupComposables();
    const onSelect = vi.fn();
    const { container } = mount({ editable: true, onSelect });
    const section = container.querySelector('[data-section-id="sec-1"]') as HTMLElement;
    await fireEvent.keyDown(section, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith({ kind: 'section', id: 'sec-1' });
  });

  it('Space on a focused section activates selection (Space.prevent so page does not scroll)', async () => {
    setupComposables();
    const onSelect = vi.fn();
    const { container } = mount({ editable: true, onSelect });
    const section = container.querySelector('[data-section-id="sec-1"]') as HTMLElement;
    await fireEvent.keyDown(section, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith({ kind: 'section', id: 'sec-1' });
  });

  it('clicking is a no-op when editable=false (public path)', async () => {
    setupComposables();
    const onSelect = vi.fn();
    const { container } = mount({ editable: false, onSelect });
    const section = container.querySelector('[data-section-id="sec-1"]') as HTMLElement;
    await fireEvent.click(section);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking is a no-op when onSelect is undefined (editable but no editor wired)', async () => {
    // Defensive: a consumer might pass :editable=true to preview-only
    // surfaces without an editor (e.g. theme preview). The chrome
    // still renders but click must not crash.
    setupComposables();
    const { container } = mount({ editable: true });
    const section = container.querySelector('[data-section-id="sec-1"]') as HTMLElement;
    // Should not throw — the optional chaining in onSectionActivate
    // guards the undefined callback.
    await fireEvent.click(section);
    // No assertion needed — surviving the click is the test.
    expect(section).not.toBeNull();
  });

  it('selectedId={kind:"section", id} adds --selected modifier to that section only', () => {
    setupComposables();
    const { container } = mount({
      editable: true,
      selectedId: { kind: 'section', id: 'sec-1' },
    });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.classList.contains('cpub-layout-section--selected')).toBe(true);
    expect(section?.getAttribute('aria-selected')).toBe('true');
  });

  it('selectedId=null leaves no section selected (aria-selected=false)', () => {
    setupComposables();
    const { container } = mount({ editable: true, selectedId: null });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.classList.contains('cpub-layout-section--selected')).toBe(false);
    expect(section?.getAttribute('aria-selected')).toBe('false');
  });

  it('selectedId={kind:"section", id:"other"} does NOT paint THIS section', () => {
    // Multiple sections in real layouts; selecting one should highlight
    // only that one.
    setupComposables();
    const { container } = mount({
      editable: true,
      selectedId: { kind: 'section', id: 'sec-DIFFERENT' },
    });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.classList.contains('cpub-layout-section--selected')).toBe(false);
  });

  it('selectedId={kind:"row", id} adds --selected to that row', () => {
    setupComposables();
    const { container } = mount({
      editable: true,
      selectedId: { kind: 'row', id: 'row-1' },
    });
    const row = container.querySelector('[data-row-id="row-1"]');
    expect(row?.classList.contains('cpub-layout-row--selected')).toBe(true);
  });

  it('public path: --selected NEVER paints even if selectedId is passed (defense in depth)', () => {
    // Belt-and-braces: even if a misconfigured caller passes selectedId
    // with editable=false, --selected must not leak. The class binding
    // is `editable && isSectionSelected(section)` so both conditions
    // must be true.
    setupComposables();
    const { container } = mount({
      editable: false,
      selectedId: { kind: 'section', id: 'sec-1' },
    });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.classList.contains('cpub-layout-section--selected')).toBe(false);
  });
});
