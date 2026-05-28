/**
 * useLayoutEditor — draft state for the /admin/layouts/[id] editor.
 *
 * Phase 3a.3. Owns:
 *   - `draft`: editable copy of the layout (mutate freely; the editor
 *     UI binds to this)
 *   - `original`: last-saved snapshot; used to compute dirty state +
 *     drives the If-Match header on save (3a.6)
 *   - `dirty`: shallow-compared marker; true when draft !== original
 *   - `save()` / `publish()` / `refresh()`: server interactions
 *
 * Auto-save (3a.6) plugs in by watching `dirty` + calling `save()`
 * after a debounce. The composable itself is sync — auto-save is a
 * separate composable to keep concerns clean.
 *
 * The composable expects to be created in an admin page context
 * (`/admin/layouts/[id]`) — it doesn't ship feature-flag guards
 * because the route + middleware already filter callers.
 */
import type { LayoutRecord } from '@commonpub/server';
import { computed, ref, type ComputedRef, type Ref } from 'vue';

export interface LayoutEditorState {
  /** The editable layout — mutate freely. */
  draft: Ref<LayoutRecord | null>;
  /** Last-saved snapshot, kept in sync with the server. */
  original: Ref<LayoutRecord | null>;
  /** True when draft has diverged from original. */
  dirty: ComputedRef<boolean>;
  /** True when a save is in flight. */
  saving: Ref<boolean>;
  /** Last save status — drives the toolbar indicator. */
  status: Ref<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>;
  /** Last save error message (when status==='error'). */
  errorMessage: Ref<string | null>;
  /** Persist the draft. Throws on 409 (conflict — caller handles).
   *  Pass `{ force: true }` to omit the If-Match header (overwrites
   *  whatever's on the server). */
  save: (opts?: { force?: boolean }) => Promise<void>;
  /** Publish the current saved version → live. */
  publish: () => Promise<void>;
  /** Pull latest from server, replacing draft + original. */
  refresh: () => Promise<void>;
  /** Discard local changes (revert draft to original). */
  discard: () => void;
  /** Abort any in-flight save fetch — call from `onBeforeUnmount` to
   *  prevent orphan PUTs from landing after the editor unmounts (which
   *  could cause stale 409s when the user opens the editor again).
   *  R4 P2 fix (session 161). */
  abort: () => void;
}

/** Deep-clone via JSON. The LayoutRecord shape is JSON-safe (no Date/Map/Set). */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Stable JSON stringify for dirty comparison. Sort-key-aware to ignore
 * key-order differences between server response + local mutation. */
function stableString(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

export function useLayoutEditor(id: string): LayoutEditorState {
  const draft = ref<LayoutRecord | null>(null);
  const original = ref<LayoutRecord | null>(null);
  const saving = ref(false);
  const status = ref<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const errorMessage = ref<string | null>(null);

  const dirty = computed<boolean>(() => {
    if (!draft.value || !original.value) return false;
    return stableString(draft.value) !== stableString(original.value);
  });

  async function refresh(): Promise<void> {
    const fresh = await $fetch<LayoutRecord>(`/api/admin/layouts/${id}`);
    original.value = fresh;
    draft.value = clone(fresh);
    status.value = 'idle';
    errorMessage.value = null;
  }

  /**
   * In-flight save promise (single-flight guard — session 160 audit P1).
   * Two distinct triggers can fire save() in parallel: manual Save click
   * + auto-save timer, OR auto-save + visibility-flush. Without this
   * guard, both calls pass the dirty check, both set saving=true, both
   * send PUTs with the SAME (stale) If-Match. Server accepts both
   * (last-write-wins). Client's `original.updatedAt` ends up referring
   * to whichever response landed LAST in the await queue, which is not
   * guaranteed to be the same as the actual DB row's updatedAt under
   * network jitter — leading to spurious 409s on the next save.
   *
   * Pattern: store the in-flight promise; concurrent callers return
   * the SAME promise (await it). Cleared in finally so the next save
   * starts fresh.
   */
  let inFlightSave: Promise<void> | null = null;

  /**
   * AbortController for the editor's lifetime — aborted by abort() on
   * unmount (called from the page's onBeforeUnmount). The single-flight
   * guard above prevents parallel saves, so one controller suffices for
   * the whole composable instance: after abort, no further saves should
   * fire (the editor is unmounting). A new mount creates a new composable
   * instance → new controller.
   *
   * The `typeof` guard makes this resilient to environments without
   * the AbortController global (older Node test harnesses, etc).
   * R4 P2 fix (session 161).
   */
  const abortController = typeof AbortController !== 'undefined'
    ? new AbortController()
    : null;

  function abort(): void {
    abortController?.abort();
  }

  async function save(opts: { force?: boolean } = {}): Promise<void> {
    if (!draft.value || !original.value) return;
    if (!dirty.value) return;
    // Single-flight: if a save is already in flight, coalesce — return
    // the in-flight promise instead of starting a parallel request.
    // Subsequent saves are picked up by the auto-save watcher when the
    // first one completes (dirty stays true if the user kept editing).
    if (inFlightSave) return inFlightSave;

    saving.value = true;
    status.value = 'saving';
    errorMessage.value = null;
    // Capture the original.updatedAt BEFORE the request — used as the
    // If-Match value. The server's response will give us a fresh
    // updatedAt to use for the next save's optimistic-concurrency check.
    const ifMatch = opts.force ? undefined : original.value.updatedAt;

    inFlightSave = (async () => {
      try {
        const headers: Record<string, string> = {};
        if (ifMatch) headers['If-Match'] = ifMatch;
        // Signal a deliberate force-save so the server can audit-log
        // it distinctly from first-creation (both share no-If-Match).
        if (opts.force) headers['X-Cpub-Force-Save'] = '1';
        const updated = await $fetch<LayoutRecord>(`/api/admin/layouts/${id}`, {
          method: 'PUT',
          headers,
          body: {
            scope: draft.value!.scope,
            name: draft.value!.name,
            pageMeta: draft.value!.pageMeta ?? undefined,
            zones: draft.value!.zones,
            state: draft.value!.state,
          },
          // Cancel the fetch if the editor unmounts mid-save. Catch block
          // below recognises the AbortError and short-circuits without
          // surfacing it as a user-visible error.
          signal: abortController?.signal,
        });
        // Update `original` only — DON'T overwrite `draft`. The user may
        // have made further edits while the save was in flight; those
        // edits stay in draft + the dirty comparison correctly flips
        // true again so the auto-save composable schedules a follow-up.
        // The server returns the saved snapshot which becomes the new
        // baseline for If-Match.
        original.value = updated;
        status.value = 'saved';
      } catch (err) {
        const e = err as { statusCode?: number; statusMessage?: string; message?: string; name?: string };
        // AbortError: the editor unmounted mid-save (the user navigated
        // away). The component is gone — surfacing "Save failed" is
        // wrong (the user isn't here to see it, and the fetch was
        // CANCELLED, not failed). Reset to idle + re-throw so the
        // outer caller knows the promise didn't complete normally,
        // but skip the user-visible status/error mutations.
        if (e.name === 'AbortError') {
          status.value = 'idle';
          errorMessage.value = null;
          throw err;
        }
        if (e.statusCode === 409) {
          status.value = 'conflict';
          errorMessage.value = 'Another admin edited this layout while you were working.';
        } else {
          status.value = 'error';
          errorMessage.value = e.statusMessage ?? e.message ?? 'Save failed';
        }
        throw err;
      } finally {
        saving.value = false;
        inFlightSave = null;
      }
    })();

    return inFlightSave;
  }

  async function publish(): Promise<void> {
    if (!draft.value) return;
    // Save first if dirty — publish snapshots the LAST SAVED state.
    if (dirty.value) await save();
    await $fetch(`/api/admin/layouts/${id}/publish`, { method: 'POST' });
    await refresh();
  }

  function discard(): void {
    if (!original.value) return;
    draft.value = clone(original.value);
    status.value = 'idle';
    errorMessage.value = null;
  }

  return {
    draft,
    original,
    dirty,
    saving,
    status,
    errorMessage,
    save,
    publish,
    refresh,
    discard,
    abort,
  };
}
