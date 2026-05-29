/**
 * Tests for <LayoutRow> — the row component extracted from LayoutSlot
 * in Phase 3b/A. Owns:
 *  - row + section markup (shape preserved from pre-extraction LayoutSlot)
 *  - section selection chrome (tabindex / role / aria-pressed)
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
} = {}) {
  return render(LayoutRow, {
    props: {
      row: props.row ?? makeRow('row-1', [makeSection('sec-1')]),
      route: '/test',
      zone: 'main',
      editable: props.editable ?? false,
      isPreview: true,
      onSelect: props.onSelect,
      selectedId: props.selectedId ?? null,
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

  it('disabled option is reactive — flips with editable prop', () => {
    mount({ editable: false });
    const [, options] = firstDroppableCall();
    const disabled = options.disabled;
    expect(disabled).toBeDefined();
    // ComputedRef — read .value for the current state.
    expect((disabled as { value?: boolean }).value).toBe(true);
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

  it('public path (editable=false) STILL registers makeDroppable but disabled=true', () => {
    // The composable is called unconditionally in setup (Vue rules-of-
    // hooks). The disabled flag is what gates behavior. Asserting
    // unconditional registration locks the structural choice.
    mount({ editable: false });
    expect(makeDroppableMock).toHaveBeenCalledTimes(1);
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
  it('editable=true sections have tabindex=0 + role=button', () => {
    const { container } = mount({ editable: true });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.getAttribute('tabindex')).toBe('0');
    expect(section?.getAttribute('role')).toBe('button');
  });

  it('editable=false sections have NO tabindex / role (public path)', () => {
    const { container } = mount({ editable: false });
    const section = container.querySelector('[data-section-id="sec-1"]');
    expect(section?.getAttribute('tabindex')).toBeNull();
    expect(section?.getAttribute('role')).toBeNull();
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
