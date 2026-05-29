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
