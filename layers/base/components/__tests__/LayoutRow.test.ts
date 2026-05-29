/**
 * Tests for <LayoutRow> — the row component extracted from LayoutSlot
 * in Phase 3b/A. Owns:
 *  - row + section markup (shape preserved from pre-extraction LayoutSlot)
 *  - section selection chrome (tabindex / aria-selected / aria-label)
 *  - makeDroppable wiring (commit E)
 *  - drop dispatcher delegation to dispatchSectionDrop (pure fn — tested
 *    separately in useLayoutDrag.test.ts)
 *
 * The dnd-kit mock returns a record-able vi.fn for makeDroppable so we
 * can assert: it was called once per row, with `disabled` reactive to
 * editable, groups:['section'], onDrop wired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, computed } from 'vue';

// vi.mock is hoisted above all imports, so referencing a module-level
// const from the factory throws "cannot access before initialization".
// vi.hoisted moves the declaration above the hoisted vi.mock too.
const { makeDroppableMock } = vi.hoisted(() => ({
  // Stub returns inert reactive values. The MOCK ITSELF is the spy —
  // tests read its `mock.calls` to assert the options passed.
  makeDroppableMock: vi.fn(() => ({
    isAllowed: { value: true },
    isDragOver: { value: undefined },
  })),
}));
vi.mock('@vue-dnd-kit/core', () => ({
  DnDProvider: { template: '<div><slot/></div>' },
  DragPreview: { template: '<div />' },
  makeDraggable: () => ({
    selected: { value: false },
    isDragging: { value: false },
    isAllowed: { value: true },
    isDragOver: { value: undefined },
  }),
  makeDroppable: makeDroppableMock,
  useDnDProvider: () => ({}),
  makeSelectionArea: () => ({}),
  makeConstraintArea: () => ({}),
  makeAutoScroll: () => ({}),
}));

import LayoutRow from '../LayoutRow.vue';
import type { LayoutRow as LayoutRowType, LayoutSection } from '../../composables/useLayout';

/* ---- Composable stubs (same shape as LayoutSlot.test.ts) ---- */

function setupComposables(): void {
  const g = globalThis as Record<string, unknown>;
  g.useFeatures = () => ({ features: ref({ admin: true, layoutEngine: true }) });
  g.useAuth = () => ({ isAuthenticated: ref(false), user: ref(null) });
}

beforeEach(() => {
  setupComposables();
  // clearAllMocks NOT restoreAllMocks — preserves makeDroppableMock's
  // impl (per feedback-vi-restoreallmocks-wipes-vifn-impls memory).
  makeDroppableMock.mockClear();
});

/* ---- Fixtures ---- */

function makeSection(id: string, overrides: Partial<LayoutSection> = {}): LayoutSection {
  return {
    id,
    order: 0,
    type: 'divider',
    config: {},
    colSpan: 12,
    responsive: null,
    enabled: true,
    visibility: null,
    schemaVersion: 1,
    ...overrides,
  };
}

function makeRow(id: string, sections: LayoutSection[] = []): LayoutRowType {
  return {
    id,
    order: 0,
    config: null,
    sections,
  };
}

function mount(props: {
  row?: LayoutRowType;
  editable?: boolean;
  selectedId?: import('../../composables/useLayoutEditor').EditorSelection | null;
  onSelect?: (sel: import('../../composables/useLayoutEditor').EditorSelection) => void;
  zone?: string;
  zoneSlugs?: string[];
  findFirstRowInZone?: (zone: string) => LayoutRowType | null;
  onRemoveRow?: (zoneSlug: string, rowId: string) => void;
} = {}) {
  return render(LayoutRow, {
    props: {
      row: props.row ?? makeRow('row-1', [makeSection('sec-1')]),
      route: '/test',
      zone: props.zone ?? 'main',
      editable: props.editable ?? false,
      isPreview: true,
      onSelect: props.onSelect,
      selectedId: props.selectedId ?? null,
      zoneSlugs: props.zoneSlugs,
      findFirstRowInZone: props.findFirstRowInZone,
      onRemoveRow: props.onRemoveRow,
    },
  });
}

/* ---- Render shape ---- */

describe('LayoutRow — render shape (matches pre-extraction LayoutSlot)', () => {
  it('renders .cpub-layout-row with data-row-id', () => {
    const { container } = mount();
    const row = container.querySelector('.cpub-layout-row');
    expect(row).not.toBeNull();
    expect(row?.getAttribute('data-row-id')).toBe('row-1');
  });

  it('renders one .cpub-layout-section per row.sections entry', () => {
    const row = makeRow('r', [makeSection('s1'), makeSection('s2'), makeSection('s3')]);
    const { container } = mount({ row });
    const sections = container.querySelectorAll('.cpub-layout-section');
    expect(sections).toHaveLength(3);
  });

  it('skips sections with enabled=false', () => {
    const row = makeRow('r', [
      makeSection('s1'),
      makeSection('s2', { enabled: false }),
      makeSection('s3'),
    ]);
    const { container } = mount({ row });
    const sections = container.querySelectorAll('.cpub-layout-section');
    expect(sections).toHaveLength(2);
  });
});

/* ---- makeDroppable wiring ---- */

/**
 * vue-tsc strict types `vi.fn(() => x).mock.calls` as `[][]` because
 * the factory has no parameter signature. Casting each `.mock.calls[i]`
 * inline gets verbose; one typed accessor + `as never` (per
 * feedback-vue-tsc-strict-vs-vitest) keeps the rest of the suite clean.
 */
type DroppableOptions = {
  groups?: string[];
  disabled?: { value?: boolean } | boolean;
  events?: { onDrop?: (e: unknown) => void };
};
type DroppablePayloadFn = () => Array<{ id: string }>;
function firstDroppableCall(): [unknown, DroppableOptions, DroppablePayloadFn] {
  return makeDroppableMock.mock.calls[0] as never;
}

describe('LayoutRow — makeDroppable wiring (Phase 3b/A)', () => {
  it('calls makeDroppable once per row instance with groups:["section"]', () => {
    mount({ editable: true });
    expect(makeDroppableMock).toHaveBeenCalledTimes(1);
    const [, options] = firstDroppableCall();
    expect(options.groups).toEqual(['section']);
  });

  it('passes a reactive disabled ComputedRef when editable (registered)', () => {
    mount({ editable: true });
    const [, options] = firstDroppableCall();
    const disabled = options.disabled;
    expect(disabled).toBeDefined();
    // ComputedRef — read .value for the current state (false in editor).
    expect((disabled as { value?: boolean }).value).toBe(false);
  });

  it('disabled is FALSE when editable=true (drops accepted)', () => {
    mount({ editable: true });
    const [, options] = firstDroppableCall();
    expect((options.disabled as { value?: boolean }).value).toBe(false);
  });

  it('payload factory returns row.sections LIVE (re-reads on each call)', () => {
    const row = makeRow('r', [makeSection('s1')]);
    mount({ row, editable: true });
    const [, , payloadFn] = firstDroppableCall();
    // Vue wraps row as a reactive proxy on the component side, so
    // identity (toBe) diverges from the test's un-proxied view. The
    // contract we ACTUALLY care about: the factory reads through to
    // the live row.sections — pushes to the test's row become visible
    // in subsequent calls (no snapshot caching).
    expect(payloadFn().map((s) => s.id)).toEqual(['s1']);
    row.sections.push(makeSection('s2'));
    expect(payloadFn().map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('onDrop handler is wired (callable without crash)', () => {
    mount({ editable: true });
    const [, options] = firstDroppableCall();
    const onDrop = options.events?.onDrop;
    expect(typeof onDrop).toBe('function');
    // Calling with an empty event → noop, no throw.
    expect(() => onDrop?.({ draggedItems: [], hoveredDraggable: undefined })).not.toThrow();
  });

  it('public path (editable=false) does NOT call makeDroppable — provider-not-found guard', () => {
    // Session 169 P0 regression guard. makeDroppable injects the dnd-kit
    // provider at setup and THROWS "DnD provider not found" with no
    // <DnDProvider> ancestor — disabled:true does NOT suppress that inject.
    // The public render path (homepage layout canary, custom pages) has no
    // provider, so calling makeDroppable there crashed the page with a 500.
    // The fix instantiates the droppable ONLY in editable mode; the public
    // path must never touch dnd-kit. (The old test asserted the OPPOSITE —
    // "STILL registers ... but disabled=true" — which encoded the exact
    // behavior that took commonpub.io's homepage down. See
    // feedback-integration-test-full-output-path.)
    mount({ editable: false });
    expect(makeDroppableMock).not.toHaveBeenCalled();
  });
});

/* ---- Move Up / Move Down (WCAG 2.1.1 non-drag a11y path) ---- */

describe('LayoutRow — moveSection (Move Up / Move Down buttons)', () => {
  it('Move Down on s1 (idx 0) → row becomes [s2, s1, s3]', async () => {
    const row = makeRow('r', [makeSection('s1'), makeSection('s2'), makeSection('s3')]);
    const { container } = mount({ row, editable: true });
    // Find the Move Down button for s1.
    const s1 = container.querySelector('[data-section-id="s1"]')!;
    const downBtn = s1.querySelector('[aria-label="Move divider down"]') as HTMLElement;
    await fireEvent.click(downBtn);
    expect(row.sections.map((s) => s.id)).toEqual(['s2', 's1', 's3']);
  });

  it('Move Up on s3 (idx 2) → row becomes [s1, s3, s2]', async () => {
    const row = makeRow('r', [makeSection('s1'), makeSection('s2'), makeSection('s3')]);
    const { container } = mount({ row, editable: true });
    const s3 = container.querySelector('[data-section-id="s3"]')!;
    const upBtn = s3.querySelector('[aria-label="Move divider up"]') as HTMLElement;
    await fireEvent.click(upBtn);
    expect(row.sections.map((s) => s.id)).toEqual(['s1', 's3', 's2']);
  });

  it('Move Up on the FIRST section is a noop (bounds-check)', async () => {
    const row = makeRow('r', [makeSection('s1'), makeSection('s2')]);
    const { container } = mount({ row, editable: true });
    const s1 = container.querySelector('[data-section-id="s1"]')!;
    const upBtn = s1.querySelector('[aria-label="Move divider up"]') as HTMLElement;
    await fireEvent.click(upBtn);
    expect(row.sections.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('Move Down on the LAST section is a noop', async () => {
    const row = makeRow('r', [makeSection('s1'), makeSection('s2')]);
    const { container } = mount({ row, editable: true });
    const s2 = container.querySelector('[data-section-id="s2"]')!;
    const downBtn = s2.querySelector('[aria-label="Move divider down"]') as HTMLElement;
    await fireEvent.click(downBtn);
    expect(row.sections.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('move buttons are NOT rendered when editable=false (public path pristine)', () => {
    const row = makeRow('r', [makeSection('s1'), makeSection('s2')]);
    const { container } = mount({ row, editable: false });
    expect(container.querySelector('.cpub-layout-section-moves')).toBeNull();
  });
});

/* ---- Selection chrome (regression: still works after extraction) ---- */

describe('LayoutRow — selection chrome (Phase 3b/A)', () => {
  it('editable=true sections have tabindex=0 + aria-label (NO role=button, NO aria-selected — sessions 163+165)', () => {
    const { container } = mount({ editable: true });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.getAttribute('tabindex')).toBe('0');
    expect(section?.getAttribute('role')).toBeNull();
    expect(section?.getAttribute('aria-selected')).toBeNull(); // session 165 axe fix
    expect(section?.getAttribute('aria-label')).toBeTruthy();
  });

  it('editable=false sections have NO tabindex / aria-selected / aria-label (public path)', () => {
    const { container } = mount({ editable: false });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.getAttribute('tabindex')).toBeNull();
    expect(section?.getAttribute('role')).toBeNull();
    expect(section?.getAttribute('aria-selected')).toBeNull();
    expect(section?.getAttribute('aria-label')).toBeNull();
  });

  it('clicking a section calls onSelect', async () => {
    const onSelect = vi.fn();
    const { container } = mount({ editable: true, onSelect });
    const section = container.querySelector('[data-section-id="sec-1"]') as HTMLElement;
    await fireEvent.click(section);
    expect(onSelect).toHaveBeenCalledWith({ kind: 'section', id: 'sec-1' });
  });

  it('selectedId={kind:"row", id} paints --selected on the row', () => {
    const { container } = mount({
      editable: true,
      selectedId: { kind: 'row', id: 'row-1' },
    });
    const row = container.querySelector('[data-row-id="row-1"]');
    expect(row?.classList.contains('cpub-layout-row--selected')).toBe(true);
  });
});

/* ---- Move to zone … (Phase 3b/B keyboard cross-zone path) ---- */

describe('LayoutRow — moveSectionToZone (Phase 3b/B)', () => {
  it('clicking a zone option appends section to the target zone\'s first row', async () => {
    const sidebarRow: LayoutRowType = {
      id: 'r-sidebar',
      order: 0,
      config: null,
      sections: [makeSection('side-existing')],
    };
    const sourceRow = makeRow('r-main', [makeSection('movable')]);
    const { container } = mount({
      row: sourceRow,
      editable: true,
      zone: 'main',
      zoneSlugs: ['main', 'sidebar'],
      findFirstRowInZone: (z) => (z === 'sidebar' ? sidebarRow : null),
    });

    const trigger = container.querySelector(
      '[aria-label="Move divider to another zone"]',
    ) as HTMLElement;
    expect(trigger).not.toBeNull();
    await fireEvent.click(trigger);

    // Popover opens; pick sidebar.
    const zoneBtn = container.querySelector(
      '.cpub-layout-section-move-menu-item',
    ) as HTMLElement;
    expect(zoneBtn).not.toBeNull();
    await fireEvent.click(zoneBtn);

    expect(sourceRow.sections.map((s) => s.id)).toEqual([]);
    expect(sidebarRow.sections.map((s) => s.id)).toEqual(['side-existing', 'movable']);
  });

  it('button is hidden when availableZones is empty (no other zones with rows)', () => {
    const { container } = mount({
      editable: true,
      zone: 'main',
      zoneSlugs: ['main'],
      findFirstRowInZone: () => null,
    });
    expect(
      container.querySelector('[aria-label="Move divider to another zone"]'),
    ).toBeNull();
  });

  it('current zone is excluded from the popover (no self-move)', async () => {
    const mainRow = makeRow('r-main', [makeSection('keep')]);
    const sidebarRow: LayoutRowType = {
      id: 'r-side',
      order: 0,
      config: null,
      sections: [],
    };
    const { container } = mount({
      row: mainRow,
      editable: true,
      zone: 'main',
      zoneSlugs: ['main', 'sidebar'],
      findFirstRowInZone: (z) => (z === 'sidebar' ? sidebarRow : z === 'main' ? mainRow : null),
    });
    const trigger = container.querySelector(
      '[aria-label="Move divider to another zone"]',
    ) as HTMLElement;
    await fireEvent.click(trigger);
    const items = container.querySelectorAll('.cpub-layout-section-move-menu-item');
    // Only sidebar — main (current) should not appear.
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent?.toLowerCase()).toContain('sidebar');
  });

  it('zones with zero rows are excluded (no landing target)', async () => {
    const mainRow = makeRow('r-main', [makeSection('keep')]);
    const { container } = mount({
      row: mainRow,
      editable: true,
      zone: 'main',
      zoneSlugs: ['main', 'sidebar', 'full-width'],
      findFirstRowInZone: (z) => {
        if (z === 'sidebar') return { id: 'r-side', order: 0, config: null, sections: [] };
        return null; // full-width has no rows
      },
    });
    const trigger = container.querySelector(
      '[aria-label="Move divider to another zone"]',
    ) as HTMLElement;
    await fireEvent.click(trigger);
    const items = container.querySelectorAll('.cpub-layout-section-move-menu-item');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent?.toLowerCase()).toContain('sidebar');
  });
});

/* ---- FLIP animation wrapping (Phase 3b/B) ---- */

/*
 * Note on TransitionGroup in test env: @testing-library/vue stubs
 * TransitionGroup as <transition-group-stub>, NOT <div tag="div">. The
 * browser runtime renders it as <div>. So we don't check tagName.
 * The contracts we CAN test:
 *   - the wrapper carries the `.cpub-layout-row` class (forwarded by
 *     the stub) + correct modifier classes
 *   - children (sections) render through the stub's default slot
 *   - public-path branch doesn't add `--editable`
 * The FLIP transition CSS rules + prefers-reduced-motion media query
 * are CSS — code-reviewed, not unit-tested. Mocking matchMedia for
 * jsdom buys little over reading the CSS source.
 */

describe('LayoutRow — FLIP animation wrapping (Phase 3b/B)', () => {
  it('editable=true: row carries the editable modifier, sections render', () => {
    const { container } = mount({ editable: true });
    const row = container.querySelector('.cpub-layout-row');
    expect(row).not.toBeNull();
    expect(row?.classList.contains('cpub-layout-row--editable')).toBe(true);
    expect(row?.querySelectorAll('.cpub-layout-section').length).toBeGreaterThan(0);
  });

  it('editable=false: public-path byte-pattern preserved (no editable, sections rendered)', () => {
    const { container } = mount({ editable: false });
    const row = container.querySelector('.cpub-layout-row');
    expect(row).not.toBeNull();
    expect(row?.classList.contains('cpub-layout-row--editable')).toBe(false);
    expect(row?.querySelectorAll('.cpub-layout-section').length).toBe(1);
  });

  it('multiple sections all render through TG (children forwarded)', () => {
    const row = makeRow('r', [
      makeSection('a'),
      makeSection('b'),
      makeSection('c'),
    ]);
    const { container } = mount({ row, editable: true });
    const ids = Array.from(
      container.querySelectorAll('[data-section-id]'),
    ).map((s) => s.getAttribute('data-section-id'));
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

/* ---- Remove Row × button (Session 164 polish) ---- */

describe('LayoutRow — Remove Row × (Session 164)', () => {
  it('renders the remove button when editable=true + onRemoveRow provided', () => {
    const { container } = mount({
      editable: true,
      onRemoveRow: vi.fn(),
    });
    expect(container.querySelector('[aria-label*="Remove this row"]')).not.toBeNull();
  });

  it('does NOT render the remove button on the public path (editable=false)', () => {
    const { container } = mount({
      editable: false,
      onRemoveRow: vi.fn(), // even if a callback was provided
    });
    expect(container.querySelector('[aria-label*="Remove this row"]')).toBeNull();
  });

  it('does NOT render the remove button when no callback provided (editable but no handler)', () => {
    const { container } = mount({ editable: true });
    expect(container.querySelector('[aria-label*="Remove this row"]')).toBeNull();
  });

  it('click fires onRemoveRow with (zone, rowId)', async () => {
    const onRemoveRow = vi.fn();
    const row = makeRow('r-target', []);
    const { container } = mount({
      row,
      zone: 'sidebar',
      editable: true,
      onRemoveRow,
    });
    const btn = container.querySelector('[aria-label*="Remove this row"]') as HTMLElement;
    await fireEvent.click(btn);
    expect(onRemoveRow).toHaveBeenCalledWith('sidebar', 'r-target');
  });

  it('aria-label includes the zone name (frame of reference for SR users)', () => {
    const { container } = mount({
      zone: 'main',
      editable: true,
      onRemoveRow: vi.fn(),
    });
    const btn = container.querySelector('[aria-label*="Remove this row"]');
    expect(btn?.getAttribute('aria-label')).toContain('main');
  });
});

/* ---- Phase 3c round-2 audit P1: resizable:false neighbour ---- */

describe('LayoutRow — resize handle + resizable:false neighbour (round-2 audit P1)', () => {
  it('startResize neighbourMin equals neighbour.colSpan when neighbour is resizable:false', async () => {
    // Use real built-in sections so we can rely on the registry's
    // resizable flags (heading = resizable: true; hero = resizable:
    // false). Mount editable + getDraft to wire the handle closure.
    const { useLayoutResize } = await import('../../composables/useLayoutResize');
    const resize = useLayoutResize();
    resize.cancelResize(); // ensure idle

    const headingSection: LayoutSection = {
      id: 'sec-heading',
      order: 0,
      type: 'heading',
      config: { text: 'Title', level: 2 },
      colSpan: 8,
      responsive: null,
      enabled: true,
      visibility: null,
      schemaVersion: 1,
    };
    const heroSection: LayoutSection = {
      id: 'sec-hero',
      order: 1,
      type: 'hero',
      config: {} as never,
      colSpan: 4, // not the default 12 so the neighbourMin assertion is meaningful
      responsive: null,
      enabled: true,
      visibility: null,
      schemaVersion: 1,
    };
    const row = makeRow('r1', [headingSection, heroSection]);

    const { container } = render(LayoutRow, {
      props: {
        row,
        route: '/',
        zone: 'main',
        editable: true,
        isPreview: false,
        onSelect: () => {},
        selectedId: null,
        zoneSlugs: ['main'],
        findFirstRowInZone: () => null,
        findRow: () => row,
        findZone: () => 'main',
        // Provide a draft getter so the resize handle closure renders.
        getDraft: () => ({ zones: [{ zone: 'main', rows: [row] }] } as never),
      },
    });

    // Find the heading section's resize handle (first section's right edge).
    const headingEl = container.querySelector('[data-section-id="sec-heading"]') as HTMLElement;
    const handle = headingEl.querySelector('.cpub-layout-section-resize-handle') as HTMLElement;
    expect(handle).not.toBeNull();

    // Dispatch the pointerdown — the closure resolves bounds + calls startResize.
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 1,
      button: 0,
      pointerType: 'mouse',
      clientX: 200,
      bubbles: true,
    }));

    // Assert state machine moved to 'resizing' with the fixed-width
    // neighbour rule applied: neighbourMin === neighbour's current colSpan (4).
    expect(resize.state.value.kind).toBe('resizing');
    if (resize.state.value.kind === 'resizing') {
      expect(resize.state.value.neighbourId).toBe('sec-hero');
      expect(resize.state.value.neighbourMin).toBe(4);
      expect(resize.state.value.neighbourStartColSpan).toBe(4);
    }
    resize.cancelResize();
  });
});
