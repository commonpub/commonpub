/**
 * Tests for useLayoutAutoSave — the debounced auto-save watcher.
 *
 * Phase 3a.6. Exercises the timer behavior: schedule on dirty, reset
 * on subsequent dirt, cancel on unmount, skip when paused.
 *
 * onBeforeUnmount needs a real component instance; use a tiny test
 * Vue component to host the composable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computed, defineComponent, h, ref, nextTick } from 'vue';
import { render } from '@testing-library/vue';
import { useLayoutAutoSave } from '../useLayoutAutoSave';

describe('useLayoutAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function hostFactory(opts: {
    dirty: { value: boolean };
    save: () => Promise<void>;
    debounceMs?: number;
    paused?: { value: boolean };
  }) {
    return defineComponent({
      setup() {
        const dirtyRef = computed<boolean>(() => opts.dirty.value);
        useLayoutAutoSave({
          dirty: dirtyRef,
          save: opts.save,
          debounceMs: opts.debounceMs,
          paused: opts.paused as never,
        });
        return () => h('div');
      },
    });
  }

  it('fires save after debounceMs once dirty becomes true', async () => {
    const dirty = ref(false);
    const save = vi.fn().mockResolvedValue(undefined);
    const host = render(hostFactory({ dirty, save, debounceMs: 100 }));

    dirty.value = true;
    await nextTick();
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);

    host.unmount();

  });

  it('resets the timer on subsequent dirty triggers (debounce coalesces edits)', async () => {
    const dirty = ref(false);
    const save = vi.fn().mockResolvedValue(undefined);
    const host = render(hostFactory({ dirty, save, debounceMs: 100 }));

    // Simulate a stream of edits: toggle dirty true→false→true rapidly
    // to model the editor re-evaluating after each user keystroke.
    dirty.value = true;
    await nextTick();
    vi.advanceTimersByTime(50);

    // Trigger watcher again with a state change
    dirty.value = false;
    await nextTick();
    dirty.value = true;
    await nextTick();
    vi.advanceTimersByTime(50);
    expect(save).not.toHaveBeenCalled(); // still inside the new window

    vi.advanceTimersByTime(50);
    expect(save).toHaveBeenCalledTimes(1);

    host.unmount();

  });

  it('does not fire save when dirty is false', async () => {
    const dirty = ref(true);
    const save = vi.fn().mockResolvedValue(undefined);
    const host = render(hostFactory({ dirty, save, debounceMs: 100 }));

    // Watcher does not fire on mount (flush: post + initial state matches).
    // Flip to false; nothing should schedule.
    dirty.value = false;
    await nextTick();
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();

    host.unmount();

  });

  it('skips scheduling when paused is true', async () => {
    const dirty = ref(false);
    const paused = ref(true);
    const save = vi.fn().mockResolvedValue(undefined);
    const host = render(hostFactory({ dirty, paused, save, debounceMs: 100 }));

    dirty.value = true;
    await nextTick();
    vi.advanceTimersByTime(200);
    expect(save).not.toHaveBeenCalled();

    host.unmount();

  });

  it('cancels the pending timer on unmount (no save fires after unmount)', async () => {
    const dirty = ref(false);
    const save = vi.fn().mockResolvedValue(undefined);
    const host = render(hostFactory({ dirty, save, debounceMs: 100 }));

    dirty.value = true;
    await nextTick();
    vi.advanceTimersByTime(50);
    host.unmount();

    vi.advanceTimersByTime(100);
    expect(save).not.toHaveBeenCalled();
  });

  it('swallows save errors (so the watcher does not reject)', async () => {
    const dirty = ref(false);
    const save = vi.fn().mockRejectedValue(new Error('save failed'));
    const host = render(hostFactory({ dirty, save, debounceMs: 100 }));

    dirty.value = true;
    await nextTick();
    vi.advanceTimersByTime(100);
    // Let the swallowed promise settle
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    // No unhandled rejection — vitest would surface it via process.on if so.
    host.unmount();

  });
});
