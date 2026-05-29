/**
 * Tests for useLayoutDrag — the pure drag-drop dispatcher.
 *
 * No dnd-kit infrastructure needed: every function is pure, takes
 * plain JS objects. The component layer (LayoutRow + palette tile) is
 * tested separately with mocked makeDraggable / makeDroppable.
 *
 * Phase 3b/A scope:
 *   - palette-section-spec → splice into row.sections
 *   - section-instance from THIS row → reorder via splice-remove + splice-insert
 *   - section-instance from a DIFFERENT row → noop (deferred to 3b/B)
 *   - missing payload → noop
 *   - missing hovered draggable → append
 */
import { describe, it, expect } from 'vitest';
import type { IDragEvent, IPlacement } from '@vue-dnd-kit/core';
import {
  createSectionFromSpec,
  paletteDragPayload,
  computeInsertIndex,
  dispatchSectionDrop,
  type PaletteSectionDragPayload,
  type SectionInstanceDragPayload,
} from '../useLayoutDrag';
import type { LayoutRow, LayoutSection } from '../useLayout';
import type { SectionDefinition } from '@commonpub/ui';
import { z } from 'zod';

/* ---- Test fixtures ---- */

/** Minimal section def for createSectionFromSpec / paletteDragPayload tests. */
function makeDef(overrides: Partial<SectionDefinition> = {}): SectionDefinition {
  return {
    type: 'heading',
    name: 'Heading',
    description: 'h1-h6',
    icon: 'fa-heading',
    category: 'content',
    configSchema: z.object({ level: z.number(), text: z.string() }) as unknown as SectionDefinition['configSchema'],
    defaultConfig: { level: 2, text: 'Section heading' } as Record<string, unknown>,
    schemaVersion: 1,
    component: { template: '<div />' } as unknown as SectionDefinition['component'],
    minColSpan: 3,
    maxColSpan: 12,
    defaultColSpan: 12,
    resizable: true,
    ...overrides,
  };
}

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

function makeRow(id: string, sections: LayoutSection[] = []): LayoutRow {
  return {
    id,
    order: 0,
    config: null,
    sections,
  };
}

function placement(p: Partial<IPlacement> = {}): IPlacement {
  return {
    top: false,
    right: false,
    bottom: false,
    left: false,
    center: false,
    ...p,
  };
}

/** Build a minimal IDragEvent — only the fields the dispatcher actually reads.
 *  Cast through unknown so we don't have to construct the full provider/helpers. */
function makeEvent(opts: {
  payload: PaletteSectionDragPayload | SectionInstanceDragPayload | undefined;
  hoveredIdx?: number;
  hoveredPlacement?: IPlacement;
}): IDragEvent {
  const draggedItems = opts.payload
    ? [{ index: 0, item: opts.payload, items: [opts.payload], data: undefined }]
    : [];
  const hoveredDraggable = opts.hoveredIdx !== undefined
    ? {
        element: {} as HTMLElement,
        placement: opts.hoveredPlacement ?? placement(),
        index: opts.hoveredIdx,
        item: {} as unknown,
        items: [] as unknown[],
        data: undefined,
      }
    : undefined;
  return {
    draggedItems,
    dropZone: undefined,
    hoveredDraggable,
    provider: {} as IDragEvent['provider'],
    helpers: {} as IDragEvent['helpers'],
  } as IDragEvent;
}

/* ---- createSectionFromSpec ---- */

describe('createSectionFromSpec', () => {
  it('mints a section with a fresh uuid + the spec config + defaultColSpan', () => {
    const spec = paletteDragPayload(makeDef());
    const section = createSectionFromSpec(spec);
    expect(section.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(section.type).toBe('heading');
    expect(section.config).toEqual({ level: 2, text: 'Section heading' });
    expect(section.colSpan).toBe(12);
    expect(section.schemaVersion).toBe(1);
    expect(section.enabled).toBe(true);
    expect(section.responsive).toBeNull();
    expect(section.visibility).toBeNull();
  });

  it('two consecutive mints get distinct ids (each click drops a fresh section)', () => {
    const spec = paletteDragPayload(makeDef());
    const a = createSectionFromSpec(spec);
    const b = createSectionFromSpec(spec);
    expect(a.id).not.toBe(b.id);
  });

  it('clones defaultConfig so mutating the new section does not affect the def', () => {
    const def = makeDef({ defaultConfig: { level: 2, text: 'orig' } });
    const spec = paletteDragPayload(def);
    const section = createSectionFromSpec(spec);
    (section.config as { text: string }).text = 'mutated';
    expect((def.defaultConfig as { text: string }).text).toBe('orig');
  });
});

/* ---- paletteDragPayload ---- */

describe('paletteDragPayload', () => {
  it('wraps the def in a kind-tagged payload', () => {
    const payload = paletteDragPayload(makeDef());
    expect(payload.kind).toBe('palette-section-spec');
    expect(payload.sectionType).toBe('heading');
    expect(payload.defaultColSpan).toBe(12);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.defaultConfig).toEqual({ level: 2, text: 'Section heading' });
  });

  it('shallow-clones defaultConfig so the dragged payload is independent of registry mutations', () => {
    const def = makeDef({ defaultConfig: { level: 1, text: 'x' } });
    const payload = paletteDragPayload(def);
    (def.defaultConfig as { text: string }).text = 'changed-after-drag-started';
    expect((payload.defaultConfig as { text: string }).text).toBe('x');
  });
});

/* ---- computeInsertIndex ---- */

describe('computeInsertIndex', () => {
  it('no hovered draggable → returns fallbackLen (append)', () => {
    const event = makeEvent({ payload: paletteDragPayload(makeDef()) });
    expect(computeInsertIndex(event, 3)).toBe(3);
  });

  it('hovered with placement.left → returns hovered.index (insert BEFORE)', () => {
    const event = makeEvent({
      payload: paletteDragPayload(makeDef()),
      hoveredIdx: 2,
      hoveredPlacement: placement({ left: true }),
    });
    expect(computeInsertIndex(event, 99)).toBe(2);
  });

  it('hovered with placement.right → returns hovered.index + 1 (insert AFTER)', () => {
    const event = makeEvent({
      payload: paletteDragPayload(makeDef()),
      hoveredIdx: 2,
      hoveredPlacement: placement({ right: true }),
    });
    expect(computeInsertIndex(event, 99)).toBe(3);
  });

  it('hovered with placement.top → returns hovered.index (vertical-list fallback path for cross-row)', () => {
    const event = makeEvent({
      payload: paletteDragPayload(makeDef()),
      hoveredIdx: 1,
      hoveredPlacement: placement({ top: true }),
    });
    expect(computeInsertIndex(event, 99)).toBe(1);
  });

  it('hovered with placement.bottom → returns hovered.index + 1', () => {
    const event = makeEvent({
      payload: paletteDragPayload(makeDef()),
      hoveredIdx: 1,
      hoveredPlacement: placement({ bottom: true }),
    });
    expect(computeInsertIndex(event, 99)).toBe(2);
  });
});

/* ---- dispatchSectionDrop ---- */

describe('dispatchSectionDrop — palette → row (new section)', () => {
  it('splices a fresh section at the computed index', () => {
    const row = makeRow('R1', [makeSection('S1'), makeSection('S2')]);
    const event = makeEvent({
      payload: paletteDragPayload(makeDef()),
      hoveredIdx: 1, // dropped over S2
      hoveredPlacement: placement({ left: true }), // insert BEFORE S2 → index 1
    });
    const outcome = dispatchSectionDrop(event, row);

    expect(outcome.kind).toBe('inserted');
    expect(row.sections).toHaveLength(3);
    expect(row.sections[1]!.type).toBe('heading');
    expect(row.sections[0]!.id).toBe('S1');
    expect(row.sections[2]!.id).toBe('S2');
    if (outcome.kind === 'inserted') {
      expect(outcome.at).toBe(1);
    }
  });

  it('appends when no hovered draggable (drop on empty row area)', () => {
    const row = makeRow('R1', [makeSection('S1')]);
    const event = makeEvent({ payload: paletteDragPayload(makeDef()) });
    const outcome = dispatchSectionDrop(event, row);
    expect(outcome.kind).toBe('inserted');
    expect(row.sections).toHaveLength(2);
    expect(row.sections[1]!.type).toBe('heading');
  });

  it('inserts into an EMPTY row (zone with no sections yet)', () => {
    const row = makeRow('R1', []);
    const event = makeEvent({ payload: paletteDragPayload(makeDef()) });
    const outcome = dispatchSectionDrop(event, row);
    expect(outcome.kind).toBe('inserted');
    expect(row.sections).toHaveLength(1);
    expect(row.sections[0]!.type).toBe('heading');
  });
});

describe('dispatchSectionDrop — section-instance → same row (reorder)', () => {
  it('drag S1 RIGHT of S3 → row becomes [S2, S3, S1] (within-row reorder)', () => {
    const sections = [makeSection('S1'), makeSection('S2'), makeSection('S3')];
    const row = makeRow('R1', sections);
    const dragged = sections[0]!;
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: dragged,
        fromRowId: 'R1',
      } satisfies SectionInstanceDragPayload,
      hoveredIdx: 2, // hovered over S3
      hoveredPlacement: placement({ right: true }), // insert AFTER S3 → index 3
    });
    const outcome = dispatchSectionDrop(event, row);
    expect(outcome.kind).toBe('reordered');
    expect(row.sections.map((s) => s.id)).toEqual(['S2', 'S3', 'S1']);
    if (outcome.kind === 'reordered') {
      expect(outcome.from).toBe(0);
      expect(outcome.to).toBe(2); // adjusted because source was before target
    }
  });

  it('drag S3 LEFT of S1 → row becomes [S3, S1, S2]', () => {
    const sections = [makeSection('S1'), makeSection('S2'), makeSection('S3')];
    const row = makeRow('R1', sections);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: sections[2]!,
        fromRowId: 'R1',
      },
      hoveredIdx: 0,
      hoveredPlacement: placement({ left: true }),
    });
    dispatchSectionDrop(event, row);
    expect(row.sections.map((s) => s.id)).toEqual(['S3', 'S1', 'S2']);
  });

  it('drag-to-same-place (no movement) → outcome reordered with from===to', () => {
    // Drag S2 onto S2-right (i.e. AFTER S2) — splice removes S2 from
    // index 1, then re-inserts at index 1 (after target adjustment).
    const sections = [makeSection('S1'), makeSection('S2'), makeSection('S3')];
    const row = makeRow('R1', sections);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: sections[1]!,
        fromRowId: 'R1',
      },
      hoveredIdx: 1,
      hoveredPlacement: placement({ right: true }),
    });
    dispatchSectionDrop(event, row);
    // The row's content is unchanged in a no-op reorder.
    expect(row.sections.map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
  });
});

describe('dispatchSectionDrop — section-instance from a DIFFERENT row (3b/B cross-row + cross-zone)', () => {
  it('cross-row drop WITHOUT ctx.findRow → noop (backward-compat with 2-arg call)', () => {
    const row = makeRow('R1', [makeSection('S1')]);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: makeSection('S-other'),
        fromRowId: 'R-OTHER',
      },
    });
    const outcome = dispatchSectionDrop(event, row);
    expect(outcome.kind).toBe('noop');
    if (outcome.kind === 'noop') expect(outcome.reason).toBe('no-find-row');
    expect(row.sections.map((s) => s.id)).toEqual(['S1']);
  });

  it('cross-row drop WITH ctx.findRow → moved outcome + sections shift', () => {
    const sourceSection = makeSection('S-cross');
    const sourceRow = makeRow('R-SOURCE', [makeSection('S-keep'), sourceSection]);
    const destRow = makeRow('R-DEST', [makeSection('D1')]);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: sourceSection,
        fromRowId: 'R-SOURCE',
      },
      hoveredIdx: 0,
      hoveredPlacement: placement({ left: true }), // insert BEFORE D1
    });
    const findRow = (id: string): LayoutRow | null =>
      id === 'R-SOURCE' ? sourceRow : id === 'R-DEST' ? destRow : null;
    const outcome = dispatchSectionDrop(event, destRow, { findRow });

    expect(outcome.kind).toBe('moved');
    if (outcome.kind === 'moved') {
      expect(outcome.section.id).toBe('S-cross');
      expect(outcome.fromRowId).toBe('R-SOURCE');
      expect(outcome.fromIdx).toBe(1);
      // fromTotal reflects the source BEFORE the splice
      expect(outcome.fromTotal).toBe(2);
      expect(outcome.toRowId).toBe('R-DEST');
      expect(outcome.toIdx).toBe(0);
      // toTotal is the destination AFTER the insert
      expect(outcome.toTotal).toBe(2);
    }
    expect(sourceRow.sections.map((s) => s.id)).toEqual(['S-keep']);
    expect(destRow.sections.map((s) => s.id)).toEqual(['S-cross', 'D1']);
  });

  it('cross-row drop appending to destination (no hovered draggable → end)', () => {
    const sourceSection = makeSection('S-move');
    const sourceRow = makeRow('R-SOURCE', [sourceSection]);
    const destRow = makeRow('R-DEST', [makeSection('D1'), makeSection('D2')]);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: sourceSection,
        fromRowId: 'R-SOURCE',
      },
      // No hoveredIdx → append
    });
    const findRow = (id: string): LayoutRow | null =>
      id === 'R-SOURCE' ? sourceRow : id === 'R-DEST' ? destRow : null;
    const outcome = dispatchSectionDrop(event, destRow, { findRow });
    expect(outcome.kind).toBe('moved');
    if (outcome.kind === 'moved') expect(outcome.toIdx).toBe(2);
    expect(destRow.sections.map((s) => s.id)).toEqual(['D1', 'D2', 'S-move']);
    expect(sourceRow.sections).toHaveLength(0);
  });

  it('cross-row drop with findRow returning null for source → noop', () => {
    const destRow = makeRow('R-DEST', [makeSection('D1')]);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: makeSection('S-orphan'),
        fromRowId: 'R-VANISHED',
      },
    });
    const outcome = dispatchSectionDrop(event, destRow, {
      findRow: () => null,
    });
    expect(outcome.kind).toBe('noop');
    if (outcome.kind === 'noop') expect(outcome.reason).toBe('source-row-not-found');
    expect(destRow.sections.map((s) => s.id)).toEqual(['D1']);
  });

  it('cross-row drop where section vanished from source mid-flight → noop', () => {
    const sourceRow = makeRow('R-SOURCE', [makeSection('S-different')]);
    const destRow = makeRow('R-DEST', [makeSection('D1')]);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: makeSection('S-ghost'), // not present in source
        fromRowId: 'R-SOURCE',
      },
    });
    const outcome = dispatchSectionDrop(event, destRow, {
      findRow: (id) => (id === 'R-SOURCE' ? sourceRow : id === 'R-DEST' ? destRow : null),
    });
    expect(outcome.kind).toBe('noop');
    if (outcome.kind === 'noop') expect(outcome.reason).toBe('section-not-found');
  });
});

describe('dispatchSectionDrop — defensive paths', () => {
  it('empty draggedItems → noop', () => {
    const row = makeRow('R1', [makeSection('S1')]);
    const event = makeEvent({ payload: undefined });
    const outcome = dispatchSectionDrop(event, row);
    expect(outcome.kind).toBe('noop');
    if (outcome.kind === 'noop') expect(outcome.reason).toBe('no-dragged-item');
    expect(row.sections).toHaveLength(1);
  });

  it('section-instance with stale fromRowId pointing here but id not found → noop', () => {
    // Concurrent edit removed the section just before drop landed.
    const row = makeRow('R1', [makeSection('S1')]);
    const event = makeEvent({
      payload: {
        kind: 'section-instance',
        section: makeSection('S-GHOST'),
        fromRowId: 'R1',
      },
    });
    const outcome = dispatchSectionDrop(event, row);
    expect(outcome.kind).toBe('noop');
    if (outcome.kind === 'noop') expect(outcome.reason).toBe('section-not-found');
  });
});
