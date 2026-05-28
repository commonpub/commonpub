/**
 * useLayoutAutoSave — debounced auto-save for the layout editor.
 *
 * Phase 3a.6. Watches a dirty flag; when it flips true, waits
 * `debounceMs` (default 1500 per docs/plans/layout-and-pages.md
 * §7.13) then calls save. Further edits within the window reset
 * the timer.
 *
 * Caller (the editor page) owns:
 *   - the dirty ref (from useLayoutEditor)
 *   - the save fn (from useLayoutEditor)
 *   - error/conflict handling — save() throws on 409 and the page
 *     catches it; auto-save itself just swallows + lets the
 *     editor.status reflect the result
 *
 * The composable returns a `cancel()` for tests + manual pause; the
 * timer is automatically cleared on component unmount.
 */
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue';

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

  onBeforeUnmount(cancel);

  return { cancel };
}
