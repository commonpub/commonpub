/**
 * Tests for useEditorAutosave — the debounced save engine extracted from
 * the docs page editor (docs/[siteSlug]/edit.vue).
 *
 * Covers the four moving parts the page used to own inline:
 *   1. trailing-debounce dirty tracking (markDirty re-arms the timer)
 *   2. the idle→saving→saved/error status machine + re-entrancy guard
 *   3. Cmd/Ctrl+S keydown → immediate save
 *   4. beforeunload guard + timer/listener cleanup on unmount
 *
 * onMounted/onBeforeUnmount need a real component instance; host the
 * composable in a tiny test component (same pattern as
 * useLayoutAutoSave.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { render } from '@testing-library/vue';
import { useEditorAutosave, type UseEditorAutosave, type UseEditorAutosaveOptions } from '../useEditorAutosave';

/**
 * Render a host component that exposes the composable instance back to the
 * test via the returned ref. Returns { api, unmount }.
 */
function mountAutosave(opts: UseEditorAutosaveOptions): { api: UseEditorAutosave; unmount: () => void } {
  let api!: UseEditorAutosave;
  const host = render(
    defineComponent({
      setup() {
        api = useEditorAutosave(opts);
        return () => h('div');
      },
    }),
  );
  return { api, unmount: host.unmount };
}

describe('useEditorAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('markDirty sets isDirty and persists after the debounce window', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist, debounceMs: 5000 });

    expect(api.isDirty.value).toBe(false);
    api.markDirty();
    expect(api.isDirty.value).toBe(true);
    expect(persist).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4999);
    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(api.isDirty.value).toBe(false);
    expect(api.status.value).toBe('saved');
    unmount();
  });

  it('trailing debounce: repeated markDirty re-arms the timer so persist fires once after the LAST edit', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist, debounceMs: 5000 });

    api.markDirty();
    vi.advanceTimersByTime(3000);
    api.markDirty(); // re-arm — resets the 5s window
    vi.advanceTimersByTime(3000); // 6s since first edit, but only 3s since last
    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000); // now 5s since last edit
    expect(persist).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('markDirty is suppressed while isLoading (programmatic content load does not mark dirty)', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist, debounceMs: 5000 });

    api.isLoading.value = true;
    api.markDirty();
    expect(api.isDirty.value).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(persist).not.toHaveBeenCalled();
    unmount();
  });

  it('saveNow walks idle→saving→saved and clears dirty', async () => {
    let resolvePersist!: () => void;
    const persist = vi.fn().mockReturnValue(new Promise<void>((r) => { resolvePersist = r; }));
    const { api, unmount } = mountAutosave({ persist });

    api.markDirty();
    expect(api.status.value).toBe('idle');

    const p = api.saveNow();
    expect(api.status.value).toBe('saving');
    expect(api.saving.value).toBe(true);

    resolvePersist();
    await p;
    expect(api.status.value).toBe('saved');
    expect(api.saving.value).toBe(false);
    expect(api.isDirty.value).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('saveNow does nothing when canSave() is false', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist, canSave: () => false });

    await api.saveNow();
    expect(persist).not.toHaveBeenCalled();
    expect(api.status.value).toBe('idle');
    unmount();
  });

  it('saveNow on failure sets status=error, keeps dirty, and reports the error', async () => {
    const err = new Error('boom');
    const persist = vi.fn().mockRejectedValue(err);
    const onError = vi.fn();
    const { api, unmount } = mountAutosave({ persist, onError });

    api.markDirty();
    await api.saveNow();
    expect(api.status.value).toBe('error');
    expect(api.isDirty.value).toBe(true); // not cleared — the change is still unsaved
    expect(api.saving.value).toBe(false);
    expect(onError).toHaveBeenCalledWith(err);
    unmount();
  });

  it('re-entrancy guard: a second saveNow while one is in flight does not double-persist', async () => {
    let resolvePersist!: () => void;
    const persist = vi.fn().mockReturnValue(new Promise<void>((r) => { resolvePersist = r; }));
    const { api, unmount } = mountAutosave({ persist });

    const first = api.saveNow();
    await api.saveNow(); // should be a no-op while first is pending
    expect(persist).toHaveBeenCalledTimes(1);

    resolvePersist();
    await first;
    expect(persist).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('reset clears dirty, resets status to idle, and cancels any pending save', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist, debounceMs: 5000 });

    api.markDirty();
    api.reset();
    expect(api.isDirty.value).toBe(false);
    expect(api.status.value).toBe('idle');

    await vi.advanceTimersByTimeAsync(5000);
    expect(persist).not.toHaveBeenCalled(); // pending timer was cancelled
    unmount();
  });

  it('Cmd/Ctrl+S triggers an immediate save and prevents the browser default', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist });

    api.markDirty();
    const e = new KeyboardEvent('keydown', { key: 's', metaKey: true, cancelable: true });
    const prevented = vi.spyOn(e, 'preventDefault');
    document.dispatchEvent(e);
    await nextTick();
    await Promise.resolve();

    expect(prevented).toHaveBeenCalled();
    expect(persist).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('beforeunload calls preventDefault only when dirty', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist });

    // Clean: should NOT block unload
    const clean = new Event('beforeunload', { cancelable: true });
    const cleanPrevent = vi.spyOn(clean, 'preventDefault');
    window.dispatchEvent(clean);
    expect(cleanPrevent).not.toHaveBeenCalled();

    // Dirty: should block unload
    api.markDirty();
    const dirty = new Event('beforeunload', { cancelable: true });
    const dirtyPrevent = vi.spyOn(dirty, 'preventDefault');
    window.dispatchEvent(dirty);
    expect(dirtyPrevent).toHaveBeenCalled();
    unmount();
  });

  it('unmount cancels the pending timer and detaches listeners', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { api, unmount } = mountAutosave({ persist, debounceMs: 5000 });

    api.markDirty();
    unmount();

    // Pending autosave must not fire post-unmount.
    await vi.advanceTimersByTimeAsync(5000);
    expect(persist).not.toHaveBeenCalled();

    // Keydown listener detached — Cmd+S after unmount is a no-op.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));
    await Promise.resolve();
    expect(persist).not.toHaveBeenCalled();
  });
});
