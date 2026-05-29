/**
 * Tests for <LayoutSection> — the per-section component extracted from
 * LayoutRow in Phase 3b/A. Owns:
 *  - the rendered section markup (.cpub-layout-section + data-* attrs)
 *  - tabindex / role / aria for selection a11y
 *  - click / Enter / Space → onSelect callback
 *  - makeDraggable wiring (this commit's main delivery)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';

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

import LayoutSection from '../LayoutSection.vue';
import type { LayoutSection as LayoutSectionType } from '../../composables/useLayout';

function makeSection(id: string, overrides: Partial<LayoutSectionType> = {}): LayoutSectionType {
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

beforeEach(() => {
  makeDraggableMock.mockClear();
});

type DraggableOptions = {
  groups?: string[];
  disabled?: { value?: boolean } | boolean;
};
type DraggablePayloadFn = () => [number, Array<Record<string, unknown>>];
function firstDraggableCall(): [unknown, DraggableOptions, DraggablePayloadFn] {
  return makeDraggableMock.mock.calls[0] as never;
}

/* ---- Render shape ---- */

describe('LayoutSection — render shape', () => {
  it('renders .cpub-layout-section with data-section-id + data-section-type', () => {
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('sec-X', { type: 'heading' }),
        rowId: 'row-1',
        route: '/test',
        zone: 'main',
        editable: false,
      },
    });
    const el = container.querySelector('.cpub-layout-section');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-section-id')).toBe('sec-X');
    expect(el?.getAttribute('data-section-type')).toBe('heading');
  });

  it('editable=false has no tabindex / aria-selected / aria-label (public path pristine)', () => {
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('s'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: false,
      },
    });
    const el = container.querySelector('.cpub-layout-section');
    expect(el?.getAttribute('tabindex')).toBeNull();
    expect(el?.getAttribute('aria-selected')).toBeNull();
    expect(el?.getAttribute('aria-label')).toBeNull();
  });

  it('editable=true sets tabindex=0 + aria-label (NO role=button, NO aria-selected)', () => {
    // Session 163 R1/R2-1 audit fix: role='button' would have nested ARIA
    // buttons (Move Up/Down inside) which violates the role spec.
    // Session 165 (Phase 3d.5 axe regression caught this): aria-selected
    // requires a supporting role (option/gridcell/row/tab/treeitem); the
    // section's outer div has no role + no listbox parent, so aria-selected
    // was an axe `aria-allowed-attr` violation. Convey selection state
    // via aria-label state-in-name instead — universally supported, no
    // role plumbing required.
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('s', { type: 'hero' }),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: true,
      },
    });
    const el = container.querySelector('.cpub-layout-section');
    expect(el?.getAttribute('tabindex')).toBe('0');
    expect(el?.getAttribute('role')).toBeNull(); // intentionally not 'button'
    expect(el?.getAttribute('aria-selected')).toBeNull(); // dropped — was axe violation
    expect(el?.getAttribute('aria-label')).toBe('Select hero section');
  });
});

/* ---- Selection ---- */

describe('LayoutSection — selection', () => {
  it('click → onSelect({kind:"section", id})', async () => {
    const onSelect = vi.fn();
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('S1'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: true,
        onSelect,
      },
    });
    const el = container.querySelector('.cpub-layout-section') as HTMLElement;
    await fireEvent.click(el);
    expect(onSelect).toHaveBeenCalledWith({ kind: 'section', id: 'S1' });
  });

  it('Enter activates selection', async () => {
    const onSelect = vi.fn();
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('S1'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: true,
        onSelect,
      },
    });
    const el = container.querySelector('.cpub-layout-section') as HTMLElement;
    await fireEvent.keyDown(el, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('selectedId matching this section adds --selected + aria-label flips to "Selected:" prefix', () => {
    // Session 165 — aria-selected dropped (axe `aria-allowed-attr`
    // violation: the outer div has no supporting role). Selection state
    // now flows through aria-label (state-in-name) + the visual --selected
    // class + outline.
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('S1', { type: 'hero' }),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: true,
        selectedId: { kind: 'section', id: 'S1' },
      },
    });
    const el = container.querySelector('.cpub-layout-section');
    expect(el?.classList.contains('cpub-layout-section--selected')).toBe(true);
    expect(el?.getAttribute('aria-selected')).toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('Selected: hero section');
  });
});

/* ---- makeDraggable wiring ---- */

describe('LayoutSection — makeDraggable wiring (Phase 3b/A)', () => {
  it('calls makeDraggable once per mount with groups:["section"]', () => {
    render(LayoutSection, {
      props: {
        section: makeSection('s'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: true,
      },
    });
    expect(makeDraggableMock).toHaveBeenCalledTimes(1);
    const [, options] = firstDraggableCall();
    expect(options.groups).toEqual(['section']);
  });

  it('disabled is reactive — flips with editable', () => {
    render(LayoutSection, {
      props: {
        section: makeSection('s'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: false,
      },
    });
    const [, options] = firstDraggableCall();
    expect((options.disabled as { value?: boolean }).value).toBe(true);
  });

  it('payload factory returns section-instance envelope with fromRowId', () => {
    const section = makeSection('S1');
    render(LayoutSection, {
      props: {
        section,
        rowId: 'R-host',
        route: '/',
        zone: 'main',
        editable: true,
      },
    });
    const [, , payloadFn] = firstDraggableCall();
    const [index, items] = payloadFn();
    expect(index).toBe(0);
    expect(items).toHaveLength(1);
    const env = items[0]!;
    expect(env.kind).toBe('section-instance');
    expect(env.fromRowId).toBe('R-host');
    // Envelope carries a reference to the section — dispatcher uses
    // section.id to find the source position in the live array.
    expect((env.section as { id: string }).id).toBe('S1');
  });
});

/* ---- Placement-aware drop indicator (Session 164 polish) ---- */

describe('LayoutSection — drop-indicator class binding (Session 164)', () => {
  // Drive isDragOver from the mock so we can verify the computed
  // dropIndicatorSide → CSS class wiring across the three states.
  // Each test resets the mock's return so the next mount picks up
  // a fresh ref shape.

  function mountWithDragOver(placement: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean } | undefined) {
    // `as never` cast: makeDraggableMock's inferred return type pins
    // isDragOver to { value: undefined }; the runtime mock CAN return
    // any placement but vue-tsc narrows the literal. Matches the
    // existing typed-accessor pattern (feedback-vue-tsc-strict-vs-vitest).
    makeDraggableMock.mockReturnValueOnce({
      selected: { value: false },
      isDragging: { value: false },
      isAllowed: { value: true },
      isDragOver: { value: placement },
    } as never);
    return render(LayoutSection, {
      props: {
        section: makeSection('sec-DI'),
        rowId: 'row-1',
        route: '/',
        zone: 'main',
        editable: true,
      },
    });
  }

  it('placement.left=true → --drop-before class on the section', () => {
    const { container } = mountWithDragOver({ left: true });
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(true);
    expect(el.classList.contains('cpub-layout-section--drop-after')).toBe(false);
  });

  it('placement.right=true → --drop-after class', () => {
    const { container } = mountWithDragOver({ right: true });
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-after')).toBe(true);
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(false);
  });

  it('isDragOver=undefined → neither class applied', () => {
    const { container } = mountWithDragOver(undefined);
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(false);
    expect(el.classList.contains('cpub-layout-section--drop-after')).toBe(false);
  });

  it('placement.top=true → --drop-before class (vertical-list symmetry with computeInsertIndex)', () => {
    // Session 164 audit R2-2: dnd-kit emits top/bottom when the hovered
    // element's bbox is taller than wide. `useLayoutDrag.computeInsertIndex`
    // honors `left || top` as "insert before"; the indicator must agree
    // or it lies about the drop position.
    const { container } = mountWithDragOver({ top: true });
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(true);
    expect(el.classList.contains('cpub-layout-section--drop-after')).toBe(false);
  });

  it('placement.bottom=true → --drop-after class (vertical-list symmetry)', () => {
    const { container } = mountWithDragOver({ bottom: true });
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-after')).toBe(true);
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(false);
  });

  it('placement with no left/right/top/bottom flags (truly dead-center) → neither class', () => {
    const { container } = mountWithDragOver({});
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(false);
    expect(el.classList.contains('cpub-layout-section--drop-after')).toBe(false);
  });

  it('editable=false: drop-indicator classes NEVER apply (public path stays clean)', () => {
    makeDraggableMock.mockReturnValueOnce({
      selected: { value: false },
      isDragging: { value: false },
      isAllowed: { value: true },
      isDragOver: { value: { left: true } },
    } as never);
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('sec-pub'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: false,
      },
    });
    const el = container.querySelector('.cpub-layout-section')!;
    expect(el.classList.contains('cpub-layout-section--drop-before')).toBe(false);
  });
});
