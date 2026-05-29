/**
 * Tests for <AdminLayoutsPaletteTile> — the per-tile drag source.
 *
 * Phase 3b/A. Asserts:
 *  - makeDraggable is called once per mounted tile
 *  - groups: ['section'] matches the row droppable's group filter
 *  - payload factory returns the paletteDragPayload envelope
 *  - tile renders the section's name/description/icon + a11y label
 *
 * The dnd-kit mock is identical to LayoutRow.test.ts but records into
 * its OWN spy so palette + row test files stay decoupled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/vue';
import { z } from 'zod';

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

import AdminLayoutsPaletteTile from '../AdminLayoutsPaletteTile.vue';
import type { SectionDefinition } from '@commonpub/ui';

/* ---- Fixtures ---- */

function makeDef(overrides: Partial<SectionDefinition> = {}): SectionDefinition {
  return {
    type: 'heading',
    name: 'Heading',
    description: 'Single h1–h6 heading',
    icon: 'fa-heading',
    category: 'content',
    status: 'stable',
    configSchema: z.object({ text: z.string() }) as unknown as SectionDefinition['configSchema'],
    defaultConfig: { text: 'hi' } as Record<string, unknown>,
    schemaVersion: 1,
    component: { template: '<div />' } as unknown as SectionDefinition['component'],
    minColSpan: 3,
    maxColSpan: 12,
    defaultColSpan: 12,
    resizable: true,
    ...overrides,
  };
}

beforeEach(() => {
  makeDraggableMock.mockClear();
});

/* ---- vue-tsc-strict-safe typed accessor for the mock's calls ---- */
type DraggableOptions = { groups?: string[] };
type DraggablePayloadFn = () => [number, Array<Record<string, unknown>>];
function firstDraggableCall(): [unknown, DraggableOptions, DraggablePayloadFn] {
  return makeDraggableMock.mock.calls[0] as never;
}

/* ---- Render shape ---- */

describe('AdminLayoutsPaletteTile — render', () => {
  it('renders name + description + a11y label + drag handle attrs', () => {
    const { container } = render(AdminLayoutsPaletteTile, {
      props: { section: makeDef() },
    });
    expect(container.textContent).toContain('Heading');
    expect(container.textContent).toContain('Single h1–h6 heading');
    const tile = container.querySelector('.cpub-admin-layouts-palette-tile');
    expect(tile?.getAttribute('aria-label')).toBe('Drag to insert Heading (heading) section');
    expect(tile?.getAttribute('tabindex')).toBe('0');
    expect(tile?.getAttribute('data-section-type')).toBe('heading');
    expect(tile?.getAttribute('data-section-status')).toBe('stable');
  });

  it('beta status shows the beta badge', () => {
    const { container } = render(AdminLayoutsPaletteTile, {
      props: { section: makeDef({ status: 'beta' }) },
    });
    expect(container.textContent).toContain('beta');
    const tile = container.querySelector('.cpub-admin-layouts-palette-tile');
    expect(tile?.getAttribute('data-section-status')).toBe('beta');
  });

  it('falls back to status=stable when undefined', () => {
    const { container } = render(AdminLayoutsPaletteTile, {
      props: { section: makeDef({ status: undefined }) },
    });
    const tile = container.querySelector('.cpub-admin-layouts-palette-tile');
    expect(tile?.getAttribute('data-section-status')).toBe('stable');
  });
});

/* ---- makeDraggable wiring ---- */

describe('AdminLayoutsPaletteTile — makeDraggable wiring (Phase 3b/A)', () => {
  it('calls makeDraggable once per mount with groups:["section"]', () => {
    render(AdminLayoutsPaletteTile, { props: { section: makeDef() } });
    expect(makeDraggableMock).toHaveBeenCalledTimes(1);
    const [, options] = firstDraggableCall();
    expect(options.groups).toEqual(['section']);
  });

  it('payload factory returns [0, [paletteDragPayload(def)]] envelope', () => {
    render(AdminLayoutsPaletteTile, { props: { section: makeDef() } });
    const [, , payloadFn] = firstDraggableCall();
    const [index, items] = payloadFn();
    expect(index).toBe(0);
    expect(items).toHaveLength(1);
    const env = items[0]!;
    expect(env.kind).toBe('palette-section-spec');
    expect(env.sectionType).toBe('heading');
    expect(env.defaultColSpan).toBe(12);
    expect(env.schemaVersion).toBe(1);
    expect(env.defaultConfig).toEqual({ text: 'hi' });
  });

  it('payload factory clones defaultConfig (env stays stable as registry mutates)', () => {
    const def = makeDef({ defaultConfig: { text: 'orig' } });
    render(AdminLayoutsPaletteTile, { props: { section: def } });
    const [, , payloadFn] = firstDraggableCall();
    const env = payloadFn()[1][0]!;
    (def.defaultConfig as { text: string }).text = 'mutated';
    // The envelope's defaultConfig is a shallow clone — not affected.
    expect((env.defaultConfig as { text: string }).text).toBe('orig');
  });

  it('payload factory is invoked PER call (not snapshot-cached)', () => {
    // dnd-kit invokes the factory per drag-tick. We confirm the returned
    // array is FRESH on each call — important so a started-and-cancelled
    // drag doesn't leak a stale envelope across drags.
    render(AdminLayoutsPaletteTile, { props: { section: makeDef() } });
    const [, , payloadFn] = firstDraggableCall();
    const a = payloadFn()[1][0];
    const b = payloadFn()[1][0];
    // Same payload SHAPE, but two separate object instances.
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
