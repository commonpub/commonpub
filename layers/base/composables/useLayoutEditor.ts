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
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';

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
  /** Fire a best-effort PUT via `fetch({keepalive:true})` — survives
   *  page teardown so unsaved edits don't vanish when the tab is
   *  closed inside the 1.5s auto-save debounce window. Returns true
   *  if a request was queued, false if the no-op preconditions held
   *  (no draft/original, not dirty, or fetch unavailable). Fire-and-
   *  forget; does NOT await. Bypasses the abort controller (the whole
   *  point is for this request to outlive it).
   *
   *  Call from a `pagehide` listener (the only event that fires
   *  reliably on mobile tab-close + bfcache eviction; `beforeunload`
   *  doesn't run on iOS Safari at all). R2 P2 deferred (session 162). */
  flushBeacon: () => boolean;
  /** True when the recent conflict rate has exceeded the threshold
   *  (3 conflicts within 60s). Wire this into useLayoutAutoSave's
   *  `paused` prop so auto-save stops banging the server while the
   *  user reconciles with the other editor. Cleared by
   *  `clearConflictHistory()`. R2 P2 deferred (session 162). */
  conflictThrashing: ComputedRef<boolean>;
  /** Reset the conflict-window counter back to zero. Call after the
   *  user has explicitly refreshed/force-saved + wants auto-save to
   *  resume. */
  clearConflictHistory: () => void;
  /**
   * Current selection — drives the right-hand inspector dispatcher.
   *
   *   `null`                    → render the page-meta form (default).
   *   `{kind:'section', id:X}`  → render the section-config form (Phase 3f placeholder this session).
   *   `{kind:'row', id:Y}`      → render the row-config form (Phase 3f placeholder this session).
   *
   * Session 3b/A landing: click / Enter on a section sets selection;
   * click outside the canvas (or Esc) clears. Selection is intentionally
   * NOT persisted across refresh/discard — those operations replace the
   * draft wholesale, so the previously-selected id may no longer exist.
   *
   * See `feedback-visual-editor-ux-patterns` (inspector dispatch pattern)
   * + docs/plans/layout-and-pages.md §7.9.
   */
  selectedId: Ref<EditorSelection>;
  /** Set selection; pass `null` to clear. */
  select: (selection: EditorSelection) => void;
  /** Alias for `select(null)` — semantic sugar for click-outside / Esc. */
  clearSelection: () => void;
}

/**
 * Discriminated selection target. Encoded as an object (not a tuple) so
 * inspector callers can branch on `kind` cleanly + so future kinds
 * (e.g. `'zone'`) extend the union without breaking call sites.
 *
 * `null` = no selection (default; inspector renders page-meta form).
 */
export type EditorSelection =
  | { kind: 'section'; id: string }
  | { kind: 'row'; id: string }
  | null;

/**
 * Discriminated failure for the multi-step publish() flow.
 *
 * publish() chains three independent server calls: save (only when
 * dirty), POST /publish, then refresh. The R4 audit found that a
 * generic "Publish failed" toast hides which step actually failed —
 * the most important case being a publish-step failure AFTER a
 * successful save, where the user's changes ARE durably saved as a
 * draft but they don't know it.
 *
 * The consumer (editor page) catches `PublishStepError`, branches on
 * `step`, and renders a step-specific toast. Session 162 P2.7.
 */
export type PublishStep = 'save' | 'publish' | 'refresh';

export class PublishStepError extends Error {
  readonly step: PublishStep;
  override readonly cause: unknown;
  constructor(step: PublishStep, cause: unknown) {
    super(`Publish step "${step}" failed`);
    this.name = 'PublishStepError';
    this.step = step;
    this.cause = cause;
  }
}

/** Deep-clone via JSON. The LayoutRecord shape is JSON-safe (no Date/Map/Set). */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Stable-JSON stringify — key-order insensitive. Used only at SEED
 * time (the first non-null assignment to draft) to decide whether to
 * auto-mark pristine. The R2-audit perf concern was that this used to
 * run per-keystroke via the old `dirty` computed; here it runs once
 * per editor instance lifetime, so the O(N) cost is amortised.
 */
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

  /**
   * Dirty tracking — session 162 P2.6 (R2 audit).
   *
   * Was: `dirty = computed(stableString(draft) !== stableString(original))`.
   * Walked the entire layout JSON on every keystroke. At N=50 sections
   * the audit measured 5-10ms per keystroke; at N=200 it ate a frame
   * (>16ms). Today's homepage at N=5 hid it.
   *
   * Now: O(1) version counters. `dirtyVersion` increments on every
   * draft mutation via a deep watcher; `savedVersion` snapshots at
   * save-success (or seed/refresh/discard); `dirty` is a single
   * `dirtyVersion !== savedVersion` compare.
   *
   * The deep watcher subscribes to nested properties once at setup
   * (using Vue's reactive Proxy infrastructure); subsequent mutations
   * notify it in O(1) without re-walking. Outer ref reassignment
   * (`draft.value = ...`) re-walks the new value — rare path (initial
   * seed, refresh, discard).
   *
   * `flush: 'sync'` so dirty reflects the mutation in the SAME tick
   * (lets test code read `dirty.value` immediately after a mutation
   * without `await nextTick()`). Safe re-entrancy: the watcher only
   * mutates dirtyVersion/savedVersion, never draft itself.
   *
   * Auto-sync on initial seed: the canonical consumer pattern is
   * `editor.original.value = X; editor.draft.value = clone(X);` (the
   * editor page does exactly this after useFetch lands). On that first
   * draft assignment the watcher fires with oldDraft===null. We do a
   * ONE-TIME stable-string compare against original.value — if equal,
   * sync savedVersion so dirty starts false. If different, leave
   * savedVersion alone so dirty starts true (covers tests that seed
   * a divergent draft to assert dirty behavior).
   *
   * This single O(N) walk per editor lifetime replaces the previous
   * O(N) walk per keystroke — the audit's actual cost concern.
   */
  const dirtyVersion = ref(0);
  const savedVersion = ref(0);

  watch(
    draft,
    (newDraft, oldDraft) => {
      dirtyVersion.value++;
      if (
        oldDraft === null &&
        newDraft !== null &&
        original.value !== null &&
        stableString(newDraft) === stableString(original.value)
      ) {
        savedVersion.value = dirtyVersion.value;
      }
    },
    { deep: true, flush: 'sync' },
  );

  const dirty = computed<boolean>(() => {
    if (!draft.value || !original.value) return false;
    return dirtyVersion.value !== savedVersion.value;
  });

  /**
   * Conflict-window tracking — session 162 P2.5 (R2 audit).
   *
   * Scenario: admin clicks "Reload" in the conflict modal; while their
   * refresh is in flight a third admin saves; their next edit 409s
   * immediately. Each conflict is a different third-party save (not a
   * loop), but the UX thrashes — modal in/out/in. Worse, the auto-save
   * watcher keeps re-triggering the save-then-409 cycle.
   *
   * Mitigation: after 3 conflicts within a 60s rolling window, flip
   * `conflictThrashing` true. The editor page passes this to
   * useLayoutAutoSave's `paused` prop, halting the auto-save cycle.
   * A banner prompts the user to refresh / force-save / coordinate;
   * `clearConflictHistory()` (UI: "Resume auto-save") clears the
   * window and restarts. The 3-in-60s threshold matches what mature
   * collab editors (Notion, Linear retros) settled on after tuning.
   */
  const CONFLICT_WINDOW_MS = 60_000;
  const CONFLICT_THRESHOLD = 3;
  const conflictHistory = ref<number[]>([]);
  function recordConflict(): void {
    const now = Date.now();
    conflictHistory.value = [
      ...conflictHistory.value.filter((t) => now - t < CONFLICT_WINDOW_MS),
      now,
    ];
  }
  function clearConflictHistory(): void {
    conflictHistory.value = [];
  }
  const conflictThrashing = computed<boolean>(() => {
    // The computed only re-evaluates when `conflictHistory.value`
    // changes — Vue caches the last result otherwise. That means a
    // rolling window doesn't naturally "expire" via wall-clock time;
    // once `thrashing===true` is set, it stays true until either
    //   (a) a new conflict event mutates conflictHistory (rare while
    //       auto-save is paused — see the feedback loop below), or
    //   (b) the user explicitly calls `clearConflictHistory()`.
    //
    // Feedback loop: thrashing=true → useLayoutAutoSave.paused=true →
    // no new save attempts → no new conflicts → conflictHistory frozen
    // → thrashing stays true. That matches the intended UX: the admin
    // must explicitly acknowledge (Refresh / Force save / Resume)
    // before auto-save resumes. A wall-clock timer would silently
    // resume in the background, defeating the throttle's purpose.
    const now = Date.now();
    return conflictHistory.value.filter((t) => now - t < CONFLICT_WINDOW_MS).length
      >= CONFLICT_THRESHOLD;
  });

  /**
   * Selection state — drives the inspector dispatcher (Phase 3b/A).
   *
   * Held as a single ref containing a discriminated union. Cleared on
   * refresh/discard because those operations replace draft wholesale +
   * the selected id may no longer exist in the new draft. NOT cleared
   * on save() — the server returns the same ids in the snapshot.
   */
  const selectedId = ref<EditorSelection>(null);
  function select(selection: EditorSelection): void {
    selectedId.value = selection;
  }
  function clearSelection(): void {
    selectedId.value = null;
  }

  async function refresh(): Promise<void> {
    const fresh = await $fetch<LayoutRecord>(`/api/admin/layouts/${id}`);
    original.value = fresh;
    // Replaces a non-null draft → the auto-sync-on-null path doesn't
    // fire. Bump-and-sync explicitly so dirty starts false post-refresh.
    draft.value = clone(fresh);
    savedVersion.value = dirtyVersion.value;
    status.value = 'idle';
    errorMessage.value = null;
    // The id that was selected may not exist in the fresh snapshot
    // (another admin deleted it; we can't keep a phantom selection).
    // Clear; the inspector falls back to the page-meta form.
    selectedId.value = null;
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

  /**
   * Beacon save — session 162 P2.3.
   *
   * The auto-save composable's `visibilitychange` flush handles the
   * common Cmd+Tab / minimize case via regular `$fetch`. That works
   * because the page is still alive when the request goes out and the
   * browser drains the connection normally. But for tab close (and
   * especially iOS Safari, which doesn't fire `beforeunload` at all),
   * the page is torn down before the request finishes — the abort
   * controller cancels it, or the browser kills the network stack.
   *
   * `pagehide` fires reliably on every tab-close + bfcache event on
   * every browser; combined with `fetch(..., { keepalive: true })` the
   * browser commits to delivering the request even after the page is
   * gone (subject to the 64KB body cap, which our LayoutPayload sits
   * well under).
   *
   * sendBeacon would work too but is POST-only; we want PUT to share
   * the existing endpoint + If-Match contract. The keepalive flag is
   * the modern way to get the same lifecycle guarantee with arbitrary
   * methods. Native `fetch` is used directly (not `$fetch`/ofetch)
   * because we don't want response parsing, retries, or error wrapping
   * — the page is gone, nobody can read the result.
   */
  function flushBeacon(): boolean {
    if (typeof fetch === 'undefined') return false;
    if (!draft.value || !original.value) return false;
    if (!dirty.value) return false;

    const body = JSON.stringify({
      scope: draft.value.scope,
      name: draft.value.name,
      pageMeta: draft.value.pageMeta ?? undefined,
      zones: draft.value.zones,
      state: draft.value.state,
    });
    // Session 163 deep audit: the `keepalive: true` PUT has a 64KB body
    // cap enforced by every browser. A complex layout (many sections
    // with rich text + image URLs + visibility metadata) can exceed
    // this. The browser silently drops the request → fire-and-forget
    // becomes fire-and-vanish + the user's edits are lost. Surface
    // false here so the caller (or the beforeunload prompt) is aware
    // the beacon path can't carry this payload. Beforeunload still
    // catches the user's intent to leave; the auto-save's pre-hide
    // visibility-flush handles smaller payloads (no keepalive cap).
    const BEACON_BODY_MAX_BYTES = 60 * 1024; // 60KB — 4KB headroom under the 64KB browser cap
    if (body.length > BEACON_BODY_MAX_BYTES) {
      return false;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'If-Match': original.value.updatedAt,
      // Lets the server audit-log distinguish beacon saves from regular
      // auto-saves (helpful when tracing "did my last edit land?").
      'X-Cpub-Save-Source': 'beacon',
    };
    try {
      // Fire-and-forget. No signal so the unmount abort() cannot cancel
      // it. `keepalive:true` lets the browser deliver the request after
      // page teardown — without it, the connection dies with the page.
      void fetch(`/api/admin/layouts/${id}`, {
        method: 'PUT',
        headers,
        body,
        keepalive: true,
      });
      return true;
    } catch {
      // Swallow — the page is going away; the user isn't here to see
      // an error, and the fetch is best-effort anyway.
      return false;
    }
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
    // Capture dirtyVersion AT SAVE START so any edits the user makes
    // during the await leave `dirty` true post-save (their unsaved
    // newer edits survive). Session 162 P2.6.
    const savingVersion = dirtyVersion.value;

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
        // Mark the version we sent as durable. If the user made edits
        // during the await, dirtyVersion > savingVersion → dirty stays
        // true → auto-save schedules a follow-up. If no edits during
        // await, dirtyVersion === savingVersion → dirty becomes false.
        //
        // Session 164 audit-of-audit P3 fix — savedVersion is monotonic:
        // discard()/refresh() also write to savedVersion (syncing it to
        // the post-replacement dirtyVersion), which can leave it AHEAD
        // of the savingVersion captured at save start. Without this
        // guard, save's completion would move savedVersion BACKWARD,
        // spuriously flipping `dirty` true post-discard. Concrete trace:
        //
        //   t=0   edit (dirtyVersion=1, savedVersion=0)
        //   t=1500 save fires (savingVersion=1, in flight)
        //   t=1800 discard (draft=original; dirtyVersion=2; discard sets
        //          savedVersion=dirtyVersion=2 → dirty=false)
        //   t=2000 save completes
        //          old: savedVersion = savingVersion = 1 → dirty = (2!=1)=true (WRONG)
        //          new: savingVersion=1 NOT > savedVersion=2; skip → dirty=false ✓
        //
        // Server-state divergence (server saved pre-discard edit while
        // client discarded) still exists; abort-on-discard would close
        // it but requires more surface area. Defer; the dirty-flag UX
        // fix here is the high-leverage piece.
        if (savingVersion > savedVersion.value) {
          savedVersion.value = savingVersion;
        }
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
          // Session 162 P2.5: feed the rolling-window throttle. A single
          // 409 is normal collab; 3 within 60s is thrashing → pause
          // auto-save so the user reconciles before the next round trip.
          recordConflict();
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
    // Session 162 P2.7: wrap each step in its own try/catch so the
    // caller can render a step-specific failure toast. The most
    // important case is a 'publish' step failure AFTER a successful
    // 'save' — the user's changes are durably saved as a draft but
    // the generic "Publish failed" toast hid that.
    if (dirty.value) {
      try {
        await save();
      } catch (err) {
        throw new PublishStepError('save', err);
      }
    }

    try {
      await $fetch(`/api/admin/layouts/${id}/publish`, { method: 'POST' });
    } catch (err) {
      throw new PublishStepError('publish', err);
    }

    try {
      await refresh();
    } catch (err) {
      // Server data IS published. Only the editor's local view is
      // stale. The page handler can recommend a manual reload.
      throw new PublishStepError('refresh', err);
    }
  }

  function discard(): void {
    if (!original.value) return;
    draft.value = clone(original.value);
    // Same as refresh — non-null replacement. Sync explicitly.
    savedVersion.value = dirtyVersion.value;
    status.value = 'idle';
    errorMessage.value = null;
    // Same rationale as refresh — the discarded draft's selected id may
    // not exist in the original snapshot if the user added a section
    // then discarded.
    selectedId.value = null;
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
    flushBeacon,
    conflictThrashing,
    clearConflictHistory,
    selectedId,
    select,
    clearSelection,
  };
}
