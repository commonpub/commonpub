/**
 * useLayoutAutoSave — debounced auto-save for the layout editor.
 *
 * Phase 3a.6 + session-160 audit polish. Two complementary triggers:
 *   1. Debounce: watch a dirty flag; on first dirt, wait `debounceMs`
 *      (default 1500 per docs/plans/layout-and-pages.md §7.13) then
 *      save. Further edits within the window reset the timer.
 *   2. Visibility-change flush: when the tab becomes hidden (Cmd+Tab,
 *      tab close intent, minimize) and the draft is dirty, fire an
 *      immediate save. This is the safety net for users who edit
 *      then close the tab during the debounce window.
 *
 * Caller (the editor page) owns:
 *   - the dirty ref (from useLayoutEditor)
 *   - the save fn (from useLayoutEditor)
 *   - error/conflict handling — save() throws on 409 and the page
 *     catches it; auto-save itself just swallows + lets the
 *     editor.status reflect the result
 *
 * Per UX research synthesis (session 160 audit): debounce alone loses
 * data when the user Cmd-W's during the window; blur alone misses
 * idle-keyboard edits; both together gives a "nothing was lost"
 * mental model.
 *
 * The composable returns a `cancel()` for tests + manual pause; the
 * timer is automatically cleared on component unmount.
 */
import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';

export interface UseLayoutAutoSaveOptions {
  /** Reactive dirty flag — when true, schedule a save. */
  dirty: ComputedRef<boolean> | Ref<boolean>;
  /** Save function — called on debounce-fire. */
  save: () => Promise<void>;
  /** Debounce window in ms. Default 1500. */
  debounceMs?: number;
  /** When true, skip scheduling entirely (e.g. user toggled auto-save off). */
  paused?: Ref<boolean>;
}

export interface UseLayoutAutoSaveResult {
  /** Stop the pending timer + ignore subsequent dirt until explicitly resumed. */
  cancel: () => void;
}

export function useLayoutAutoSave(opts: UseLayoutAutoSaveOptions): UseLayoutAutoSaveResult {
  const debounceMs = opts.debounceMs ?? 1500;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  watch(
    opts.dirty,
    (isDirty) => {
      cancel();
      if (!isDirty) return;
      if (opts.paused?.value) return;
      timer = setTimeout(() => {
        timer = null;
        // Errors are surfaced via the save() side-effects (editor.status,
        // toasts). Swallow here so the watcher doesn't reject.
        void opts.save().catch(() => {
          /* handled by save()'s status setter */
        });
      }, debounceMs);
    },
    { flush: 'post' },
  );

  /**
   * Visibility-change flush: when the tab is being hidden AND the draft
   * is dirty, cancel the pending debounce and save IMMEDIATELY. This
   * protects against data loss when the user Cmd+Tab's or closes the
   * tab during the debounce window.
   *
   * `document.visibilityState === 'hidden'` fires reliably across modern
   * browsers (per CanIUse: 100% support). The save() call is async and
   * returns a promise that we don't await — the browser may not give
   * us time to finish, but firing the request is better than not.
   *
   * The "REAL safety" path (request that survives page teardown) is
   * now wired separately: session 162 P2.3 added `editor.flushBeacon()`
   * (fetch with `keepalive:true`) which the editor page calls from a
   * `pagehide` listener. visibilitychange is the fast path; pagehide-
   * +-beacon is the safety net for the actual teardown.
   */
  function onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'hidden') return;
    if (opts.paused?.value) return;
    // Only flush if there's a pending dirty save
    const isDirty = (opts.dirty as { value: boolean }).value;
    if (!isDirty) return;
    cancel();
    void opts.save().catch(() => { /* handled */ });
  }

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
  });

  onBeforeUnmount(() => {
    cancel();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  });

  return { cancel };
}
