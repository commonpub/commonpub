/**
 * Undo/redo history for a JSON-serializable reactive value.
 * Follows the snapshot pattern from useBlockEditor — deep clones via JSON stringify/parse.
 */
import { ref, computed, type Ref } from 'vue';

export interface SectionHistoryReturn {
  /** Push the current state onto the history stack (call AFTER each mutation) */
  push(): void;
  /** Undo to the previous state. Returns the restored snapshot, or null if nothing to undo. */
  undo(): unknown | null;
  /** Redo to the next state. Returns the restored snapshot, or null if nothing to redo. */
  redo(): unknown | null;
  /** Clear history (e.g. when loading a new document) */
  clear(): void;
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;
  /** True while restoring a snapshot — callers should skip re-pushing history */
  isRestoring: Ref<boolean>;
}

const MAX_HISTORY = 50;

export function useSectionHistory(source: Ref<unknown>): SectionHistoryReturn {
  const history: string[] = [];
  const historyIndex = ref(-1);
  const isRestoring = ref(false);

  function snapshot(): string {
    return JSON.stringify(source.value);
  }

  function push(): void {
    if (isRestoring.value) return;
    const snap = snapshot();
    // Truncate any future states if we branched from an earlier point
    if (historyIndex.value < history.length - 1) {
      history.splice(historyIndex.value + 1);
    }
    history.push(snap);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex.value = history.length - 1;
  }

  function undo(): unknown | null {
    if (historyIndex.value <= 0) return null;
    historyIndex.value--;
    const restored = JSON.parse(history[historyIndex.value]!) as unknown;
    isRestoring.value = true;
    source.value = restored;
    isRestoring.value = false;
    return restored;
  }

  function redo(): unknown | null {
    if (historyIndex.value >= history.length - 1) return null;
    historyIndex.value++;
    const restored = JSON.parse(history[historyIndex.value]!) as unknown;
    isRestoring.value = true;
    source.value = restored;
    isRestoring.value = false;
    return restored;
  }

  function clear(): void {
    history.splice(0, history.length);
    historyIndex.value = -1;
  }

  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.length - 1);

  return { push, undo, redo, clear, canUndo, canRedo, isRestoring };
}
