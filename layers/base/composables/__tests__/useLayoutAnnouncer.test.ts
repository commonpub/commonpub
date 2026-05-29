/**
 * Tests for useLayoutAnnouncer — the singleton SR narration channel.
 *
 * Singleton design verification: every `useLayoutAnnouncer()` call
 * gets the SAME ref + same announce fn. Auto-clear after CLEAR_AFTER_MS
 * tested with fake timers. Same-text re-announcement empties first
 * (so screen readers DO re-announce).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useLayoutAnnouncer,
  formatPosition,
  narrateInserted,
  narrateReordered,
  narrateMoveBlocked,
  narrateMovedToZone,
  narrateUndo,
  narrateRedo,
  narrateUndoEmpty,
  narrateRedoEmpty,
  narrateRowAdded,
  narrateRowRemoved,
} from '../useLayoutAnnouncer';

beforeEach(() => {
  vi.useFakeTimers();
  // Reset singleton state between tests so leaking messages don't
  // bleed across cases.
  useLayoutAnnouncer().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ---- Singleton + announce ---- */

describe('useLayoutAnnouncer — singleton', () => {
  it('two calls return the SAME message ref (singleton design)', () => {
    const a = useLayoutAnnouncer();
    const b = useLayoutAnnouncer();
    a.announce('hello');
    expect(b.message.value).toBe('hello');
  });

  it('announce sets the message immediately', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('Hero picked up.');
    expect(ann.message.value).toBe('Hero picked up.');
  });

  it('message auto-clears after CLEAR_AFTER_MS', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('test message');
    expect(ann.message.value).toBe('test message');
    vi.advanceTimersByTime(1199);
    expect(ann.message.value).toBe('test message');
    vi.advanceTimersByTime(2);
    expect(ann.message.value).toBe('');
  });

  it('second announce resets the auto-clear timer', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('first');
    vi.advanceTimersByTime(1000);
    ann.announce('second');
    vi.advanceTimersByTime(1000); // first would have cleared by now
    expect(ann.message.value).toBe('second');
    vi.advanceTimersByTime(300);
    expect(ann.message.value).toBe('');
  });

  it('clear() immediately empties + cancels pending auto-clear', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('linger');
    ann.clear();
    expect(ann.message.value).toBe('');
    // Verify the timer was cancelled by advancing well past it — if
    // it WAS still running, it would set message to '' (already '');
    // we'd not detect it. Instead, set a message AFTER clear + check
    // it survives past the original timer.
    ann.announce('after clear');
    vi.advanceTimersByTime(800);
    expect(ann.message.value).toBe('after clear');
  });
});

describe('useLayoutAnnouncer — same-text re-announcement', () => {
  it('same text twice → empties first, then re-sets (SRs DO re-announce)', async () => {
    const ann = useLayoutAnnouncer();
    ann.announce('Moved.');
    expect(ann.message.value).toBe('Moved.');
    ann.announce('Moved.');
    // Synchronously: empty
    expect(ann.message.value).toBe('');
    // Microtask resolves: back to Moved.
    await Promise.resolve();
    expect(ann.message.value).toBe('Moved.');
  });

  it('different text just replaces (no empty intermediate)', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('First.');
    ann.announce('Second.');
    expect(ann.message.value).toBe('Second.');
  });
});

/* ---- Narration helpers ---- */

describe('narration helpers', () => {
  it('formatPosition uses 1-indexed wording (humans count from 1)', () => {
    expect(formatPosition(0, 5)).toBe('position 1 of 5');
    expect(formatPosition(4, 5)).toBe('position 5 of 5');
  });

  it('narrateInserted', () => {
    expect(narrateInserted('hero', 0, 3)).toBe('hero inserted at position 1 of 3.');
  });

  it('narrateReordered', () => {
    expect(narrateReordered('hero', 0, 2, 3)).toBe(
      'hero moved from position 1 of 3 to position 3 of 3.',
    );
  });

  it('narrateMoveBlocked — direction-aware copy', () => {
    expect(narrateMoveBlocked('hero', 'up')).toBe('hero already at the first position.');
    expect(narrateMoveBlocked('hero', 'down')).toBe('hero already at the last position.');
  });

  it('narrateMovedToZone names both zones + both positions (frame of reference)', () => {
    expect(narrateMovedToZone('hero', 'main', 2, 5, 'sidebar', 0, 2)).toBe(
      'hero moved from main, position 3 of 5, to sidebar, position 1 of 2.',
    );
  });

  it('narrateUndo / narrateRedo carry the operation label verbatim', () => {
    expect(narrateUndo('move hero')).toBe('Undid: move hero.');
    expect(narrateRedo('insert image')).toBe('Redid: insert image.');
  });

  it('narrateUndoEmpty / narrateRedoEmpty — fixed copy for hotkey on empty stack', () => {
    expect(narrateUndoEmpty()).toBe('Nothing to undo.');
    expect(narrateRedoEmpty()).toBe('Nothing to redo.');
  });

  it('narrateRowAdded names the zone + 1-indexed position', () => {
    expect(narrateRowAdded('main', 2, 3)).toBe('Row added in main, position 3 of 3.');
    expect(narrateRowAdded('sidebar', 0, 1)).toBe('Row added in sidebar, position 1 of 1.');
  });

  it('narrateRowRemoved names the zone (no position — row is gone)', () => {
    expect(narrateRowRemoved('main')).toBe('Row removed from main.');
    expect(narrateRowRemoved('sidebar')).toBe('Row removed from sidebar.');
  });
});

/* ---- Polite channel ---- */

describe('useLayoutAnnouncer — polite channel', () => {
  it('two calls share the SAME politeMessage ref (singleton)', () => {
    const a = useLayoutAnnouncer();
    const b = useLayoutAnnouncer();
    a.announcePolite('undid move');
    expect(b.politeMessage.value).toBe('undid move');
  });

  it('announcePolite sets the polite ref WITHOUT touching the assertive one', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('drag in progress');
    ann.announcePolite('Undid: move hero.');
    expect(ann.message.value).toBe('drag in progress');
    expect(ann.politeMessage.value).toBe('Undid: move hero.');
  });

  it('polite message auto-clears on its own timer (separate from assertive)', () => {
    const ann = useLayoutAnnouncer();
    ann.announcePolite('polite test');
    expect(ann.politeMessage.value).toBe('polite test');
    vi.advanceTimersByTime(1199);
    expect(ann.politeMessage.value).toBe('polite test');
    vi.advanceTimersByTime(2);
    expect(ann.politeMessage.value).toBe('');
  });

  it('polite same-text re-announcement empties first (parity with assertive)', async () => {
    const ann = useLayoutAnnouncer();
    ann.announcePolite('Undid: move.');
    expect(ann.politeMessage.value).toBe('Undid: move.');
    ann.announcePolite('Undid: move.');
    expect(ann.politeMessage.value).toBe('');
    await Promise.resolve();
    expect(ann.politeMessage.value).toBe('Undid: move.');
  });

  it('clear() empties BOTH channels + cancels both timers', () => {
    const ann = useLayoutAnnouncer();
    ann.announce('assertive');
    ann.announcePolite('polite');
    ann.clear();
    expect(ann.message.value).toBe('');
    expect(ann.politeMessage.value).toBe('');
    // Verify both timers cancelled — set new messages, advance past the
    // old timers' fire-time, the new messages should survive.
    ann.announce('new assertive');
    ann.announcePolite('new polite');
    vi.advanceTimersByTime(800);
    expect(ann.message.value).toBe('new assertive');
    expect(ann.politeMessage.value).toBe('new polite');
  });
});
