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

  it('editable=true sets tabindex=0 + aria-selected + aria-label (NO role=button)', () => {
    // R1/R2-1 audit fix: role='button' would have nested ARIA buttons
    // (Move Up/Down inside) which violates the role spec. Dropped in
    // favor of aria-selected — the section is a selectable item, not
    // a button. tabindex + click+keydown handlers still wire Tab+Space+
    // Enter activation, so the keyboard contract is unchanged.
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
    expect(el?.getAttribute('aria-label')).toBe('Select hero section');
    expect(el?.getAttribute('aria-selected')).toBe('false');
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

  it('selectedId matching this section adds --selected + aria-selected=true', () => {
    const { container } = render(LayoutSection, {
      props: {
        section: makeSection('S1'),
        rowId: 'r',
        route: '/',
        zone: 'main',
        editable: true,
        selectedId: { kind: 'section', id: 'S1' },
      },
    });
    const el = container.querySelector('.cpub-layout-section');
    expect(el?.classList.contains('cpub-layout-section--selected')).toBe(true);
    expect(el?.getAttribute('aria-selected')).toBe('true');
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
