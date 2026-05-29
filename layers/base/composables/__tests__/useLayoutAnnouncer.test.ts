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
});
