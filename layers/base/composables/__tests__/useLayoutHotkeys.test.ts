/**
 * Tests for useLayoutHotkeys — keyboard shortcut handler.
 *
 * Pattern: mount a tiny Vue setup component so `onMounted` /
 * `onBeforeUnmount` fire correctly; dispatch real KeyboardEvent on
 * window; assert announcer state + history state.
 *
 * `vi.clearAllMocks()` (NOT restoreAllMocks) in afterEach per memory
 * `feedback-vi-restoreallmocks-wipes-vifn-impls`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { render } from '@testing-library/vue';
import type { LayoutRecord } from '@commonpub/server';
import type { LayoutSection } from '../useLayout';
import type { EditorSelection } from '../useLayoutEditor';
import { useLayoutHotkeys } from '../useLayoutHotkeys';
import { useLayoutHistory, insertSectionCommand } from '../useLayoutHistory';
import { useLayoutAnnouncer } from '../useLayoutAnnouncer';

/* ---- Fixture ---- */

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

function makeDraft(): LayoutRecord {
  return {
    id: 'l1',
    scope: { type: 'route', path: '/' },
    name: 'home',
    state: 'draft',
    pageMeta: null,
    zones: [
      { zone: 'main', rows: [{ id: 'r1', config: null, sections: [makeSection('s1')] }] },
    ],
    updatedAt: '2026-05-29T00:00:00.000Z',
  } as unknown as LayoutRecord;
}

/** Mount a host component that calls the hotkey composable in setup,
 *  with a closure over our mutable draft. Returns the wrapper + the
 *  draft ref so tests can mutate + check the result. */
function mountHost(initial: LayoutRecord) {
  const draft = ref<LayoutRecord | null>(initial);
  const Host = defineComponent({
    setup() {
      useLayoutHotkeys({ getDraft: () => draft.value });
      return () => h('div');
    },
  });
  const wrapper = render(Host);
  return { wrapper, draft };
}

/** Same as mountHost but with the Phase 3d options wired (selection +
 *  setSelection + onShowHelp). Each option is a ref so the test can
 *  observe the post-keypress state. */
function mountHostFull(initial: LayoutRecord, initialSel: EditorSelection = null) {
  const draft = ref<LayoutRecord | null>(initial);
  const selection = ref<EditorSelection>(initialSel);
  const helpCalls = ref<number>(0);
  const Host = defineComponent({
    setup() {
      useLayoutHotkeys({
        getDraft: () => draft.value,
        getSelection: () => selection.value,
        setSelection: (s) => { selection.value = s; },
        onShowHelp: () => { helpCalls.value++; },
      });
      return () => h('div');
    },
  });
  const wrapper = render(Host);
  return { wrapper, draft, selection, helpCalls };
}

/* ---- Test setup ---- */

beforeEach(() => {
  useLayoutHistory().clear();
  useLayoutAnnouncer().clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

/* ---- Cmd+Z = undo ---- */

describe('useLayoutHotkeys — undo', () => {
  it('Cmd+Z calls history.undo + announces polite "Undid: <label>"', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const announcer = useLayoutAnnouncer();

    // Record a command (apply already happened conceptually; this just
    // tests the keystroke path).
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 1,
      section: makeSection('s-new', 'hero'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);
    expect(history.canUndo.value).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(true);
    expect(announcer.politeMessage.value).toBe('Undid: insert hero.');
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);

    wrapper.unmount();
  });

  it('Ctrl+Z also fires undo (Win+Linux)', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();

    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-x'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    }));

    expect(history.canUndo.value).toBe(false);
    wrapper.unmount();
  });

  it('Cmd+Z on empty stack → announce "Nothing to undo." + no mutation', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const announcer = useLayoutAnnouncer();
    const before = JSON.stringify(draft.value!.zones);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(announcer.politeMessage.value).toBe('Nothing to undo.');
    expect(JSON.stringify(draft.value!.zones)).toBe(before);
    wrapper.unmount();
  });
});

/* ---- Cmd+Shift+Z = redo ---- */

describe('useLayoutHotkeys — redo', () => {
  it('Cmd+Shift+Z replays the undone command + announces polite "Redid: <label>"', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const announcer = useLayoutAnnouncer();

    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 1,
      section: makeSection('s-redo', 'image'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);
    history.undo(draft.value!);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    }));

    expect(history.canRedo.value).toBe(false);
    expect(history.canUndo.value).toBe(true);
    expect(announcer.politeMessage.value).toBe('Redid: insert image.');
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(2);

    wrapper.unmount();
  });

  it('Cmd+Shift+Z on empty future → announce "Nothing to redo."', () => {
    const { wrapper } = mountHost(makeDraft());
    const announcer = useLayoutAnnouncer();

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    }));

    expect(announcer.politeMessage.value).toBe('Nothing to redo.');
    wrapper.unmount();
  });
});

/* ---- Non-bindings ---- */

describe('useLayoutHotkeys — non-bindings', () => {
  it('Cmd+Y does NOT fire redo (deliberate per Notion/Linear/Figma convention)', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);
    history.undo(draft.value!);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'y',
      metaKey: true,
      bubbles: true,
    }));

    // future stays non-empty (no redo fired).
    expect(history.canRedo.value).toBe(true);
    wrapper.unmount();
  });

  it('plain Z (no Cmd/Ctrl) → no action', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));

    expect(history.canUndo.value).toBe(true); // unchanged
    wrapper.unmount();
  });
});

/* ---- Input-field skip ---- */

describe('useLayoutHotkeys — input/textarea skip', () => {
  it('Cmd+Z while an <input> has focus → no undo (browser native wins)', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Dispatch on the input directly (target = the input). The handler
    // is on window, but the event bubbles up.
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(history.canUndo.value).toBe(true); // undo did NOT fire
    document.body.removeChild(input);
    wrapper.unmount();
  });

  it('textarea also gets the browser native undo', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(history.canUndo.value).toBe(true);
    document.body.removeChild(ta);
    wrapper.unmount();
  });

  it('contenteditable=true also skipped', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'true');
    document.body.appendChild(ce);
    ce.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(history.canUndo.value).toBe(true);
    document.body.removeChild(ce);
    wrapper.unmount();
  });

  it('contenteditable="false" does NOT skip (it is read-only, no browser undo)', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'false');
    ce.tabIndex = 0;
    document.body.appendChild(ce);
    ce.focus();
    ce.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(history.canUndo.value).toBe(false); // undo DID fire
    document.body.removeChild(ce);
    wrapper.unmount();
  });
});

/* ---- Backspace / Delete = remove section (Phase 3d.1) ---- */

describe('useLayoutHotkeys — Backspace/Delete remove section', () => {
  it('Backspace with a section selected splices it out + announces + clears selection', () => {
    const { wrapper, draft, selection } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    const history = useLayoutHistory();
    const announcer = useLayoutAnnouncer();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(draft.value!.zones[0]!.rows[0]!.sections.map((s) => s.id)).toEqual([]);
    expect(selection.value).toBeNull();
    expect(history.canUndo.value).toBe(true);
    expect(history.lastLabel.value).toBe('remove divider');
    expect(announcer.message.value).toBe('divider removed from main. Press Command+Z to undo.');
    wrapper.unmount();
  });

  it('Delete key fires the same remove path as Backspace', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    expect(draft.value!.zones[0]!.rows[0]!.sections).toEqual([]);
    wrapper.unmount();
  });

  it('Cmd+Z restores the removed section', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    const history = useLayoutHistory();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toEqual([]);

    history.undo(draft.value!);
    expect(draft.value!.zones[0]!.rows[0]!.sections.map((s) => s.id)).toEqual(['s1']);
    wrapper.unmount();
  });

  it('Backspace with NO selection → silent noop (no mutation, no narration)', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), null);
    const announcer = useLayoutAnnouncer();
    const before = JSON.stringify(draft.value!.zones);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(JSON.stringify(draft.value!.zones)).toBe(before);
    expect(announcer.message.value).toBe('');
    wrapper.unmount();
  });

  it('Backspace with row selected (not section) → silent noop', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'row', id: 'r1' });
    const before = JSON.stringify(draft.value!.zones);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(JSON.stringify(draft.value!.zones)).toBe(before);
    wrapper.unmount();
  });

  it('rich section (non-empty config) prompts window.confirm before removal', () => {
    const rich = makeDraft();
    (rich.zones[0]!.rows[0]!.sections[0] as LayoutSection).config = { title: 'Hero' } as never;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const { wrapper } = mountHostFull(rich, { kind: 'section', id: 's1' });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0]![0]).toContain('Command+Z');
    confirmSpy.mockRestore();
    wrapper.unmount();
  });

  it('rich section + confirm cancel → no mutation, no record', () => {
    const rich = makeDraft();
    (rich.zones[0]!.rows[0]!.sections[0] as LayoutSection).config = { title: 'Keep me' } as never;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const { wrapper, draft } = mountHostFull(rich, { kind: 'section', id: 's1' });
    const history = useLayoutHistory();
    const before = JSON.stringify(draft.value!.zones);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(JSON.stringify(draft.value!.zones)).toBe(before);
    expect(history.canUndo.value).toBe(false);
    confirmSpy.mockRestore();
    wrapper.unmount();
  });

  it('empty-config section skips the confirm (sweep flow stays fast)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { wrapper } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    wrapper.unmount();
  });

  it('Backspace inside an <input> → browser-native, no remove', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);
    document.body.removeChild(input);
    wrapper.unmount();
  });

  it('Cmd+Backspace (modified) does NOT trigger remove (URL clear in Safari stays user-controlled)', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', metaKey: true, bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);
    wrapper.unmount();
  });
});

/* ---- Cmd/Ctrl+D = duplicate section (Phase 3d.2) ---- */

describe('useLayoutHotkeys — Cmd/Ctrl+D duplicate section', () => {
  it('Cmd+D with a section selected inserts a clone immediately after the source + moves selection to clone', () => {
    const { wrapper, draft, selection } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    const announcer = useLayoutAnnouncer();
    const history = useLayoutHistory();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));

    const sections = draft.value!.zones[0]!.rows[0]!.sections;
    expect(sections).toHaveLength(2);
    expect(sections[0]!.id).toBe('s1');
    expect(sections[1]!.id).not.toBe('s1'); // new id minted
    expect(sections[1]!.type).toBe('divider'); // clone shares type
    expect(selection.value).toEqual({ kind: 'section', id: sections[1]!.id });
    expect(announcer.message.value).toBe('divider duplicated at position 2 of 2.');
    expect(history.lastLabel.value).toBe('duplicate divider');
    wrapper.unmount();
  });

  it('Ctrl+D fires duplicate on Windows/Linux too', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(2);
    wrapper.unmount();
  });

  it('clone preserves authored config (deep copy)', () => {
    const richDraft = makeDraft();
    (richDraft.zones[0]!.rows[0]!.sections[0] as LayoutSection).config = { title: 'Hi' } as never;
    const { wrapper, draft } = mountHostFull(richDraft, { kind: 'section', id: 's1' });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));

    const sections = draft.value!.zones[0]!.rows[0]!.sections;
    expect(sections[1]!.config).toEqual({ title: 'Hi' });
    // Mutating the clone must NOT touch the source (deep copy).
    (sections[1] as LayoutSection).config = { title: 'Other' } as never;
    expect(sections[0]!.config).toEqual({ title: 'Hi' });
    wrapper.unmount();
  });

  it('a second Cmd+D duplicates the clone (selection chained to the new copy)', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(3);
    wrapper.unmount();
  });

  it('Cmd+Z restores the pre-duplicate state', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    const history = useLayoutHistory();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(2);
    history.undo(draft.value!);
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);
    wrapper.unmount();
  });

  it('Cmd+D with no selection → silent noop (browser bookmark not preempted)', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), null);
    const e = new KeyboardEvent('keydown', { key: 'd', metaKey: true, cancelable: true, bubbles: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false); // bookmark left alone
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);
    wrapper.unmount();
  });

  it('Cmd+Shift+D excluded (no duplicate fires)', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, shiftKey: true, bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);
    wrapper.unmount();
  });

  it('Cmd+D in an <input> → browser default, no duplicate', () => {
    const { wrapper, draft } = mountHostFull(makeDraft(), { kind: 'section', id: 's1' });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    expect(draft.value!.zones[0]!.rows[0]!.sections).toHaveLength(1);
    document.body.removeChild(input);
    wrapper.unmount();
  });
});

/* ---- ? (Shift+/) = help overlay (Phase 3d.3) ---- */

describe('useLayoutHotkeys — ? help overlay', () => {
  it('? press calls onShowHelp + preventDefault', () => {
    const { wrapper, helpCalls } = mountHostFull(makeDraft());
    const e = new KeyboardEvent('keydown', { key: '?', cancelable: true, bubbles: true });
    window.dispatchEvent(e);
    expect(helpCalls.value).toBe(1);
    expect(e.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it('? inside <input> → browser-native (no help)', () => {
    const { wrapper, helpCalls } = mountHostFull(makeDraft());
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(helpCalls.value).toBe(0);
    document.body.removeChild(input);
    wrapper.unmount();
  });

  it('? with no onShowHelp callback → silent noop, defaults NOT prevented', () => {
    const draft = ref<LayoutRecord | null>(makeDraft());
    const Host = defineComponent({
      setup() {
        useLayoutHotkeys({ getDraft: () => draft.value });
        return () => h('div');
      },
    });
    const wrapper = render(Host);
    const e = new KeyboardEvent('keydown', { key: '?', cancelable: true, bubbles: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    wrapper.unmount();
  });

  it('Cmd+? does NOT fire (modifier-free binding only)', () => {
    const { wrapper, helpCalls } = mountHostFull(makeDraft());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', metaKey: true, bubbles: true }));
    expect(helpCalls.value).toBe(0);
    wrapper.unmount();
  });
});

/* ---- Lifecycle ---- */

describe('useLayoutHotkeys — lifecycle', () => {
  it('detach() removes the handler', () => {
    const { wrapper, draft } = mountHost(makeDraft());
    const history = useLayoutHistory();
    const cmd = insertSectionCommand({
      rowId: 'r1',
      at: 0,
      section: makeSection('s-1'),
    });
    cmd.apply(draft.value!);
    history.record(cmd);

    // Verify a key DOES fire BEFORE unmount.
    expect(history.canUndo.value).toBe(true);
    wrapper.unmount();

    // After unmount, dispatch should be a noop.
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));
    // history.canUndo stays true because nothing fired — past not popped.
    expect(history.canUndo.value).toBe(true);
  });

  it('null draft → silent noop (no announce, no mutation)', () => {
    // Mount with a null-returning getDraft.
    const Host = defineComponent({
      setup() {
        useLayoutHotkeys({ getDraft: () => null });
        return () => h('div');
      },
    });
    const wrapper = render(Host);
    const announcer = useLayoutAnnouncer();

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    }));

    expect(announcer.politeMessage.value).toBe('');
    wrapper.unmount();
  });
});
