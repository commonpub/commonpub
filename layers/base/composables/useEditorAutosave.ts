/**
 * useEditorAutosave — debounced save engine for block-editor pages.
 *
 * Extracted from docs/[siteSlug]/edit.vue (session 205), which had grown
 * its own inline autosave: a debounce timer, a status state machine, the
 * Cmd+S shortcut, and a beforeunload guard all hand-wired in setup(). This
 * pulls that engine into one tested unit so the page only has to supply a
 * `persist()` callback and call `markDirty()` from its watchers.
 *
 * Why not reuse useLayoutAutoSave? That composable is a *leading*-debounce
 * watcher (it fires `debounceMs` after the dirty flag first flips true and
 * does NOT re-arm on continued edits) and deliberately owns nothing else —
 * the layout editor keeps its status/shortcuts elsewhere. The docs editor
 * needs a *trailing* debounce (save once the user pauses), plus the status
 * machine + Cmd+S + unsaved-changes guard. Different semantics, different
 * surface; consolidating the three autosave call-sites is its own follow-up.
 *
 * Router-coupled navigation guards (onBeforeRouteLeave) stay in the page —
 * this composable is intentionally router-free so it unit-tests without a
 * router instance.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseEditorAutosaveOptions {
  /** Performs the actual persistence (the PUT + any refresh). Must throw on failure. */
  persist: () => Promise<void>;
  /** Gate — autosave and manual save only run when this returns true (e.g. a page is selected). Default: always. */
  canSave?: () => boolean;
  /** Trailing-debounce window in ms. Default 5000 (docs editor saves once the user pauses for 5s). */
  debounceMs?: number;
  /** Called with the thrown error when a save fails — the page wires this to a toast. */
  onError?: (err: unknown) => void;
}

export interface UseEditorAutosave {
  /** True when there are unsaved changes. */
  isDirty: Ref<boolean>;
  /** When true, markDirty() is a no-op — set during content load so programmatic edits do not mark dirty. */
  isLoading: Ref<boolean>;
  /** Save-lifecycle status for the UI (status dot + label). */
  status: Ref<AutosaveStatus>;
  /** True while a save is in flight. */
  saving: Ref<boolean>;
  /** Mark dirty and (re)arm the trailing-debounce timer. No-op while isLoading. */
  markDirty: () => void;
  /** Cancel any pending timer and persist immediately. Used by Cmd+S, the Save button, and save-before-switch. */
  saveNow: () => Promise<void>;
  /** Clear dirty + reset status to idle — call after loading a freshly-selected page. */
  reset: () => void;
  /** Cancel a pending autosave without saving. */
  cancel: () => void;
}

export function useEditorAutosave(opts: UseEditorAutosaveOptions): UseEditorAutosave {
  const debounceMs = opts.debounceMs ?? 5000;
  const canSave = opts.canSave ?? ((): boolean => true);

  const isDirty = ref(false);
  const isLoading = ref(false);
  const status = ref<AutosaveStatus>('idle');
  const saving = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function saveNow(): Promise<void> {
    if (!canSave()) return;
    if (saving.value) return; // re-entrancy guard — never fire two PUTs for one change
    cancel();
    saving.value = true;
    status.value = 'saving';
    try {
      await opts.persist();
      isDirty.value = false;
      status.value = 'saved';
    } catch (err: unknown) {
      // Leave isDirty true — the change is still unsaved and should retry/save again.
      status.value = 'error';
      opts.onError?.(err);
    } finally {
      saving.value = false;
    }
  }

  function markDirty(): void {
    if (isLoading.value) return;
    isDirty.value = true;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (isDirty.value && canSave()) void saveNow();
    }, debounceMs);
  }

  function reset(): void {
    cancel();
    isDirty.value = false;
    status.value = 'idle';
  }

  function onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      void saveNow();
    }
  }

  function onBeforeUnload(e: BeforeUnloadEvent): void {
    if (isDirty.value) e.preventDefault();
  }

  onMounted(() => {
    if (typeof document !== 'undefined') document.addEventListener('keydown', onKeydown);
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', onBeforeUnload);
  });

  onBeforeUnmount(() => {
    cancel();
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeydown);
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', onBeforeUnload);
  });

  return { isDirty, isLoading, status, saving, markDirty, saveNow, reset, cancel };
}
