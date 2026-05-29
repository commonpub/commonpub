/**
 * Tests for useLayoutHistory — the layout editor's undo/redo stack +
 * the three command factories.
 *
 * Strategy:
 *   - Singleton state asserted via two `useLayoutHistory()` calls
 *     sharing the SAME past/future refs (mirrors the announcer test).
 *   - Command factory tests run apply + invert as a pair against a
 *     fixture draft to verify symmetry — the most-load-bearing
 *     invariant of the command pattern.
 *   - Stack semantics (cap, branch-invalidates-redo, clear) exercised
 *     against the LIVE singleton.
 *   - `clear()` between tests in beforeEach so leaks don't bleed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { LayoutRecord } from '@commonpub/server';
import type { LayoutSection } from '../useLayout';
import {
  useLayoutHistory,
  findRowInDraft,
  findZoneOfRow,
  insertSectionCommand,
  reorderSectionCommand,
  moveSectionCommand,
} from '../useLayoutHistory';

/* ---- Fixtures ---- */

function makeSection(id: string, type = 'divider'): LayoutSection {
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

/** Two zones, two rows each. Mutated per-test (each test gets a fresh
 *  draft via JSON.parse(JSON.stringify(seed))) so command mutations
 *  don't bleed across cases. */
function makeDraft(): LayoutRecord {
  return {
    id: 'layout-1',
    scope: { type: 'route', path: '/' },
    name: 'Home',
    state: 'draft',
    pageMeta: null,
    zones: [
      {
        zone: 'main',
        rows: [
          { id: 'row-main-1', config: null, sections: [makeSection('s1'), makeSection('s2')] },
          { id: 'row-main-2', config: null, sections: [makeSection('s3')] },
        ],
      },
      {
        zone: 'sidebar',
        rows: [
          { id: 'row-side-1', config: null, sections: [makeSection('s4')] },
        ],
      },
    ],
    updatedAt: '2026-05-29T00:00:00.000Z',
  } as unknown as LayoutRecord;
}

beforeEach(() => {
  useLayoutHistory().clear();
});

/* ---- Singleton ---- */

describe('useLayoutHistory — singleton', () => {
  it('two calls share the SAME past/future refs', () => {
    const a = useLayoutHistory();
    const b = useLayoutHistory();
    expect(a.past).toBe(b.past);
    expect(a.future).toBe(b.future);
  });

  it('starts empty — canUndo/canRedo both false', () => {
    const h = useLayoutHistory();
    expect(h.canUndo.value).toBe(false);
    expect(h.canRedo.value).toBe(false);
    expect(h.lastLabel.value).toBeNull();
    expect(h.nextLabel.value).toBeNull();
  });
});

/* ---- record / undo / redo round-trip ---- */

describe('useLayoutHistory — record/undo/redo round-trip', () => {
  it('record() pushes to past + clears future + flips canUndo', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    const cmd = insertSectionCommand({
      rowId: 'row-main-1',
      at: 2,
      section: makeSection('new-1', 'heading'),
    });
    cmd.apply(draft);
    h.record(cmd);

    expect(h.past.value).toHaveLength(1);
    expect(h.future.value).toHaveLength(0);
    expect(h.canUndo.value).toBe(true);
    expect(h.canRedo.value).toBe(false);
    expect(h.lastLabel.value).toBe('insert heading');
  });

  it('undo() invokes invert + moves cmd to future', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    const cmd = insertSectionCommand({
      rowId: 'row-main-1',
      at: 2,
      section: makeSection('new-1'),
    });
    cmd.apply(draft);
    h.record(cmd);

    const row = findRowInDraft(draft, 'row-main-1')!;
    expect(row.sections.map((s) => s.id)).toEqual(['s1', 's2', 'new-1']);

    const undone = h.undo(draft);
    expect(undone).toBe(cmd);
    expect(row.sections.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(h.past.value).toHaveLength(0);
    expect(h.future.value).toHaveLength(1);
    expect(h.canRedo.value).toBe(true);
  });

  it('redo() re-applies + moves cmd back to past', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    const cmd = insertSectionCommand({
      rowId: 'row-main-1',
      at: 0,
      section: makeSection('new-2', 'image'),
    });
    cmd.apply(draft);
    h.record(cmd);
    h.undo(draft);

    const redone = h.redo(draft);
    expect(redone).toBe(cmd);
    const row = findRowInDraft(draft, 'row-main-1')!;
    expect(row.sections[0]?.id).toBe('new-2');
    expect(h.past.value).toHaveLength(1);
    expect(h.future.value).toHaveLength(0);
  });

  it('undo() on empty stack returns null + does not mutate', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);
    expect(h.undo(draft)).toBeNull();
    expect(JSON.stringify(draft.zones)).toBe(before);
  });

  it('redo() on empty future returns null + does not mutate', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);
    expect(h.redo(draft)).toBeNull();
    expect(JSON.stringify(draft.zones)).toBe(before);
  });
});

/* ---- New action invalidates redo branch (Notion/Linear/Figma) ---- */

describe('useLayoutHistory — branch semantics', () => {
  it('record() AFTER undo() clears the future stack', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();

    const cmd1 = insertSectionCommand({
      rowId: 'row-main-1',
      at: 2,
      section: makeSection('alpha'),
    });
    cmd1.apply(draft);
    h.record(cmd1);

    // Undo → future has 1.
    h.undo(draft);
    expect(h.future.value).toHaveLength(1);

    // A new action records — future should clear.
    const cmd2 = insertSectionCommand({
      rowId: 'row-main-2',
      at: 0,
      section: makeSection('beta'),
    });
    cmd2.apply(draft);
    h.record(cmd2);

    expect(h.future.value).toHaveLength(0);
    expect(h.past.value).toHaveLength(1);
    expect(h.canRedo.value).toBe(false);
  });
});

/* ---- Cap ---- */

describe('useLayoutHistory — cap at 50', () => {
  it('51st record shifts the oldest out; past stays at length 50', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    for (let i = 0; i < 51; i++) {
      const cmd = insertSectionCommand({
        rowId: 'row-main-1',
        at: 0,
        section: makeSection(`cap-${i}`),
        label: `cmd-${i}`,
      });
      // Don't actually apply — we're testing stack mechanics here, the
      // apply path is covered by the round-trip tests. (Applying 51
      // unique sections into one row would clutter the draft.)
      h.record(cmd);
    }
    expect(h.past.value).toHaveLength(50);
    // The oldest (cmd-0) is gone; the newest (cmd-50) is on top.
    expect(h.past.value[0]?.label).toBe('cmd-1');
    expect(h.past.value[49]?.label).toBe('cmd-50');
  });
});

/* ---- clear() ---- */

describe('useLayoutHistory — clear()', () => {
  it('clear() empties BOTH past + future', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();
    const cmd = insertSectionCommand({
      rowId: 'row-main-1',
      at: 0,
      section: makeSection('x'),
    });
    cmd.apply(draft);
    h.record(cmd);
    h.undo(draft);
    expect(h.past.value).toHaveLength(0);
    expect(h.future.value).toHaveLength(1);

    h.clear();
    expect(h.past.value).toHaveLength(0);
    expect(h.future.value).toHaveLength(0);
    expect(h.canUndo.value).toBe(false);
    expect(h.canRedo.value).toBe(false);
  });
});

/* ---- Helpers ---- */

describe('findRowInDraft / findZoneOfRow', () => {
  it('finds rows across all zones', () => {
    const draft = makeDraft();
    expect(findRowInDraft(draft, 'row-main-1')?.id).toBe('row-main-1');
    expect(findRowInDraft(draft, 'row-side-1')?.id).toBe('row-side-1');
    expect(findRowInDraft(draft, 'ghost-row')).toBeNull();
  });

  it('finds zone slug for any row', () => {
    const draft = makeDraft();
    expect(findZoneOfRow(draft, 'row-main-1')).toBe('main');
    expect(findZoneOfRow(draft, 'row-side-1')).toBe('sidebar');
    expect(findZoneOfRow(draft, 'ghost-row')).toBeNull();
  });
});

/* ---- Command factories: apply/invert symmetry ---- */

describe('insertSectionCommand', () => {
  it('apply inserts at index; invert removes by id (round-trip restores)', () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);
    const cmd = insertSectionCommand({
      rowId: 'row-main-1',
      at: 1,
      section: makeSection('inserted'),
    });
    cmd.apply(draft);
    const row = findRowInDraft(draft, 'row-main-1')!;
    expect(row.sections.map((s) => s.id)).toEqual(['s1', 'inserted', 's2']);

    cmd.invert(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
  });

  it('apply against a vanished row is a silent noop', () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);
    const cmd = insertSectionCommand({
      rowId: 'ghost-row',
      at: 0,
      section: makeSection('orphan'),
    });
    cmd.apply(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
  });

  it('default label uses section type', () => {
    const cmd = insertSectionCommand({
      rowId: 'row-main-1',
      at: 0,
      section: makeSection('x', 'hero'),
    });
    expect(cmd.label).toBe('insert hero');
  });
});

describe('reorderSectionCommand', () => {
  it('apply moves within row; invert restores', () => {
    const draft = makeDraft();
    // Add a 3rd section so reorder is meaningful.
    findRowInDraft(draft, 'row-main-1')!.sections.push(makeSection('s2b'));
    const before = JSON.stringify(draft.zones);

    const cmd = reorderSectionCommand({
      rowId: 'row-main-1',
      sectionId: 's1',
      from: 0,
      to: 2,
    });
    cmd.apply(draft);
    const row = findRowInDraft(draft, 'row-main-1')!;
    expect(row.sections.map((s) => s.id)).toEqual(['s2', 's2b', 's1']);

    cmd.invert(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
  });

  it('apply on vanished section is silent noop', () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);
    const cmd = reorderSectionCommand({
      rowId: 'row-main-1',
      sectionId: 'ghost',
      from: 0,
      to: 1,
    });
    cmd.apply(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
  });
});

describe('moveSectionCommand', () => {
  it('apply moves cross-row; invert moves it back', () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);

    const cmd = moveSectionCommand({
      fromRowId: 'row-main-1',
      toRowId: 'row-side-1',
      sectionId: 's1',
      fromIdx: 0,
      toIdx: 0,
    });
    cmd.apply(draft);

    expect(findRowInDraft(draft, 'row-main-1')!.sections.map((s) => s.id))
      .toEqual(['s2']);
    expect(findRowInDraft(draft, 'row-side-1')!.sections.map((s) => s.id))
      .toEqual(['s1', 's4']);

    cmd.invert(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
  });

  it('apply moves cross-zone (main → sidebar) at arbitrary destination index', () => {
    const draft = makeDraft();
    const cmd = moveSectionCommand({
      fromRowId: 'row-main-1',
      toRowId: 'row-side-1',
      sectionId: 's2',
      fromIdx: 1,
      toIdx: 1, // append to sidebar's row
    });
    cmd.apply(draft);
    expect(findRowInDraft(draft, 'row-side-1')!.sections.map((s) => s.id))
      .toEqual(['s4', 's2']);
  });

  it('vanished source OR destination → silent noop on apply + invert', () => {
    const draft = makeDraft();
    const before = JSON.stringify(draft.zones);
    const cmd = moveSectionCommand({
      fromRowId: 'ghost-from',
      toRowId: 'row-side-1',
      sectionId: 's1',
      fromIdx: 0,
      toIdx: 0,
    });
    cmd.apply(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
    cmd.invert(draft);
    expect(JSON.stringify(draft.zones)).toBe(before);
  });
});

/* ---- 3-op visual-diff regression (plan §3b.9) ---- */

describe('command stack — multi-op visual diff', () => {
  it('starting layout → insert + reorder + move → expected JSON shape', () => {
    const h = useLayoutHistory();
    const draft = makeDraft();

    // Op 1: insert a hero at row-main-1 position 0.
    const op1 = insertSectionCommand({
      rowId: 'row-main-1',
      at: 0,
      section: makeSection('hero-1', 'hero'),
    });
    op1.apply(draft);
    h.record(op1);

    // Op 2: reorder hero to the end of row-main-1.
    const op2 = reorderSectionCommand({
      rowId: 'row-main-1',
      sectionId: 'hero-1',
      from: 0,
      to: 2,
    });
    op2.apply(draft);
    h.record(op2);

    // Op 3: move hero to sidebar (cross-zone).
    const op3 = moveSectionCommand({
      fromRowId: 'row-main-1',
      toRowId: 'row-side-1',
      sectionId: 'hero-1',
      fromIdx: 2,
      toIdx: 0,
    });
    op3.apply(draft);
    h.record(op3);

    // Expected final shape: main-1 = [s1, s2]; main-2 = [s3]; side-1 = [hero-1, s4].
    expect(findRowInDraft(draft, 'row-main-1')!.sections.map((s) => s.id))
      .toEqual(['s1', 's2']);
    expect(findRowInDraft(draft, 'row-main-2')!.sections.map((s) => s.id))
      .toEqual(['s3']);
    expect(findRowInDraft(draft, 'row-side-1')!.sections.map((s) => s.id))
      .toEqual(['hero-1', 's4']);

    // Now undo all three — should restore the initial draft.
    const restored = JSON.stringify(makeDraft().zones);
    h.undo(draft);
    h.undo(draft);
    h.undo(draft);
    expect(JSON.stringify(draft.zones)).toBe(restored);

    // Redo all three — back to the 3-op state.
    h.redo(draft);
    h.redo(draft);
    h.redo(draft);
    expect(findRowInDraft(draft, 'row-side-1')!.sections.map((s) => s.id))
      .toEqual(['hero-1', 's4']);
  });
});
