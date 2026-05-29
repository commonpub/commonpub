/**
 * useLayoutResize — pointer + keyboard driven section resize.
 *
 * Phase 3c. Implements the resize gesture documented in
 * `docs/plans/layout-and-pages.md` §7.5: drag the right-edge handle to
 * change a section's `colSpan` in the 12-col grid; the right neighbour
 * absorbs the inverse delta so the row's total stays constant; LAST-in-
 * row sections grow into the trailing space without a neighbour.
 *
 * Why vanilla pointer events (NOT grid-layout-plus, despite the package
 * being installed):
 *   - grid-layout-plus uses absolute positioning + transforms; our
 *     sections live in a CSS `display:grid` row via
 *     `grid-column: span var(--cpub-section-cols-lg)`. The two sizing
 *     models can't share a child element.
 *   - grid-layout-plus's interactjs registers pointerdown on the GridItem
 *     wrapper — the same DOM node `@vue-dnd-kit/core` already owns for
 *     the drag-section gesture (session 163's verified collision boundary).
 *     Owning a SEPARATE child element (the handle) sidesteps the conflict.
 *   - Resize from scratch is ~300 lines + tests; the library's
 *     coordinate model (x/y/w/h) doesn't match `colSpan` so we'd carry
 *     a propMap shim AND maintain the library.
 *   - Decision recorded in session 166-3c.md + the
 *     `feedback-phase-3-hybrid-libraries` memory entry.
 *
 * Architecture:
 *   - Module-scoped singleton state ref. Pointer + keyboard handlers
 *     read + mutate the same ref. Matches `useLayoutHistory` and
 *     `useLayoutAnnouncer`'s shape — one resize at a time across the
 *     entire editor.
 *   - Pure helpers (`computeSnappedColSpan`, `clampResize`) export
 *     separately so the composable's tests don't need pointer mocks
 *     for the math.
 *   - Live preview during drag: pointermove mutates `section.colSpan`
 *     directly so the existing CSS render path picks it up. The editor's
 *     deep watcher fires on every frame — `dirtyVersion` increments
 *     ~60×/sec but auto-save's 1.5s debounce coalesces them; the
 *     pointermove is rAF-throttled so reactivity only triggers once per
 *     frame.
 *   - On pointerup: capture the BEFORE/AFTER colSpans + commit ONE
 *     `resizeSectionCommand` to history. A pointer-up that ends at the
 *     same span as start records nothing — keeps the undo stack from
 *     filling with no-op self-equal entries (mirrors the dispatcher's
 *     `from===to` reorder skip).
 *
 * Wire diagram:
 *   - LayoutSection.vue — renders the right-edge handle button +
 *     calls `useLayoutResize().startResize(opts)` on its pointerdown.
 *   - useLayoutResize.ts (this file) — owns state + document handlers.
 *   - LayoutRow.vue — reads `state.value` to render the 12-col guide
 *     overlay + the constraint-snap label DURING a resize. Same row id
 *     only.
 *   - useLayoutHotkeys.ts — Shift+ArrowLeft / Shift+ArrowRight call
 *     `applyKeyboardResize(opts)` to change colSpan by ±1.
 *
 * **Phase 3c base-only resize (round-2 audit P2 deferral)**: this
 * composable mutates `section.colSpan` — the BASE breakpoint value.
 * When `section.responsive.lg` is set, the LG viewport renders that
 * value instead of the base; mutating the base in that case is
 * INVISIBLE at LG. v1 ships with no built-in section setting
 * `responsive` by default + no UI to author it, so this edge is
 * latent. Phase 3e (per-breakpoint editing) needs to route resize at
 * the active viewport to mutate the right field
 * (`responsive[viewport]` or `colSpan` fallback). Tracked in
 * `docs/sessions/167-kickoff.md` Path A subtask 6.
 *
 * SSR: every `document` / `window` reference is guarded with
 * `typeof window !== 'undefined'` per
 * `feedback-vitest-import-meta-client-undefined` — vitest's jsdom env
 * provides `window` so unit tests exercise the same path as the browser.
 */
import { ref, type Ref } from 'vue';
import type { LayoutRecord } from '@commonpub/server';
import type { LayoutSection } from './useLayout';
import { findSectionLocation } from './useLayoutHistory';
import {
  useLayoutHistory,
  resizeSectionCommand,
} from './useLayoutHistory';
import {
  useLayoutAnnouncer,
  narrateResize,
  narrateResizeBlocked,
} from './useLayoutAnnouncer';

/* ------------------------------------------------------------------ */
/* Pure helpers — tested independently                                  */
/* ------------------------------------------------------------------ */

/**
 * Snap a continuous pointer delta to an integer column count. The 12-col
 * grid is the unit; sub-grid pointer motion rounds to the nearest column.
 *
 *   deltaCols = round((pointerDX / containerWidth) * 12)
 *
 * `containerWidth` is the row's INSIDE width (no padding). Caller reads
 * via `getBoundingClientRect().width` at gesture-start — the value is
 * stable for the duration of a single drag (no row resize mid-drag).
 *
 * Returns the SIGNED integer delta (-12 to +12). Positive = grow; negative
 * = shrink. The caller adds it to the start span + clamps in
 * `clampResize`.
 *
 * Edge: containerWidth=0 (row not yet measured) → delta=0. Resize is
 * effectively disabled until the next pointermove with a real width;
 * pragmatically this never happens because the handle can't be clicked
 * before the row paints.
 */
export function computeSnappedColSpan(
  pointerDX: number,
  containerWidth: number,
): number {
  if (containerWidth <= 0) return 0;
  return Math.round((pointerDX / containerWidth) * 12);
}

/** Constraint-hit discriminator — drives narration + visual feedback.
 *  `null` = no constraint hit; the delta applied cleanly. */
export type ResizeConstraint = 'section-min' | 'section-max' | 'neighbour-min' | null;

/** Result of clamping a desired delta against the section's bounds AND
 *  (optionally) its right neighbour's bounds. */
export interface ClampResult {
  /** The new colSpan for the resized section, clamped. */
  newColSpan: number;
  /** The new colSpan for the right neighbour, clamped. Equals the
   *  passed `neighbourStart` when no neighbour (LAST in row). */
  newNeighbourColSpan: number;
  /** Which bound the desired delta hit. */
  constraintHit: ResizeConstraint;
  /** The numeric bound the user pushed against (for narration). */
  constraintBound: number;
}

/**
 * Clamp a desired delta against per-section + (optional) neighbour bounds.
 *
 * Invariant for LAST-in-row (no neighbour): just clamp the section's
 * new span to `[sectionMin, sectionMax]`. The trailing space is the
 * renderer's responsibility — CSS Grid flexes it to fill, or the admin
 * drops another section there.
 *
 * Invariant for non-LAST: the row's total colSpan stays constant. So
 * the neighbour absorbs the inverse of the EFFECTIVE delta (after
 * clamping the section's own bounds). If the neighbour would violate
 * ITS own min, we back off the effective delta further so the neighbour
 * sticks at its bound — the resize "stops cold" at the neighbour's
 * minimum per plan §7.5.
 *
 * Pure — no state mutation. Caller decides whether to apply.
 *
 * Pre-condition: caller has snapped + bounds-checked `desiredDelta`
 * against the grid (0 ≤ |delta| ≤ 12). The function handles any signed
 * integer though, for defensive testability.
 */
export function clampResize(params: {
  startColSpan: number;
  desiredDelta: number;
  sectionMin: number;
  sectionMax: number;
  /** Null when the section is LAST in its row. */
  neighbourStart: number | null;
  neighbourMin: number;
  neighbourMax: number;
}): ClampResult {
  const { startColSpan, desiredDelta, sectionMin, sectionMax,
          neighbourStart, neighbourMin, neighbourMax } = params;

  // 1. Desired new span for the resized section, before any clamp.
  const desiredNew = startColSpan + desiredDelta;

  // 2. Clamp against the section's own bounds first.
  let newColSpan = Math.max(sectionMin, Math.min(sectionMax, desiredNew));
  let constraintHit: ResizeConstraint = null;
  let constraintBound = 0;
  if (desiredNew < sectionMin) {
    constraintHit = 'section-min';
    constraintBound = sectionMin;
  } else if (desiredNew > sectionMax) {
    constraintHit = 'section-max';
    constraintBound = sectionMax;
  }

  // 3. LAST in row: no neighbour absorption. Section grows into trailing
  // space; shrinks leave trailing space the renderer flexes to fill.
  if (neighbourStart === null) {
    return {
      newColSpan,
      newNeighbourColSpan: 0, // sentinel — caller knows there's no neighbour
      constraintHit,
      constraintBound,
    };
  }

  // 4. Non-LAST: neighbour absorbs the inverse of the EFFECTIVE delta.
  const effectiveDelta = newColSpan - startColSpan;
  const desiredNeighbour = neighbourStart - effectiveDelta;

  // 5. Clamp the neighbour against ITS own bounds.
  const clampedNeighbour = Math.max(
    neighbourMin,
    Math.min(neighbourMax, desiredNeighbour),
  );

  // 6. If the neighbour would have violated its min, back off the section
  // by the same amount so the sum-invariant holds. Plan §7.5: "When the
  // neighbour hits its minimum, the resize stops cold."
  if (clampedNeighbour > desiredNeighbour) {
    // Neighbour hit its MIN (couldn't shrink any more). Reduce the
    // section's growth so neighbour stays at its min. Only override
    // `constraintHit` if the section's own bounds weren't the limit
    // first — neighbour-min is the binding constraint here.
    const backedOffDelta = neighbourStart - clampedNeighbour;
    newColSpan = startColSpan + backedOffDelta;
    if (constraintHit === null) {
      constraintHit = 'neighbour-min';
      constraintBound = neighbourMin;
    }
  } else if (clampedNeighbour < desiredNeighbour) {
    // Neighbour hit its MAX while shrinking the section. Rare — usually
    // means the neighbour's maxColSpan < 12 AND the section shrunk hard.
    // Back off the section so sum-invariant holds; constraint-hit
    // stays section-* because the user-side action was a section shrink.
    const backedOffDelta = neighbourStart - clampedNeighbour;
    newColSpan = startColSpan + backedOffDelta;
  }

  return {
    newColSpan,
    newNeighbourColSpan: clampedNeighbour,
    constraintHit,
    constraintBound,
  };
}

/* ------------------------------------------------------------------ */
/* State machine                                                        */
/* ------------------------------------------------------------------ */

/** State shape for the resize gesture. `idle` means no resize in flight;
 *  `resizing` carries every field the live preview + commit needs. */
export type ResizeState =
  | { kind: 'idle' }
  | {
      kind: 'resizing';
      /** The row containing the resized section — useful for the row's
       *  guide-line overlay (it filters by id). */
      rowId: string;
      /** Section being resized. */
      sectionId: string;
      /** Span at gesture-start — what the eventual `resizeSectionCommand`
       *  reverts to. */
      startColSpan: number;
      /** Live snapped span; reflects what the section's `colSpan`
       *  currently holds (the composable mutates the draft to this). */
      currentColSpan: number;
      /** Right neighbour's id; null when the resized section is LAST. */
      neighbourId: string | null;
      /** Neighbour's start + current span. 0 when no neighbour. */
      neighbourStartColSpan: number;
      neighbourCurrentColSpan: number;
      /** Per-section colSpan bounds — used by `clampResize` + by the
       *  narration helpers. */
      sectionMin: number;
      sectionMax: number;
      neighbourMin: number;
      neighbourMax: number;
      /** Section type slug — included in narration. */
      sectionType: string;
      /** Pointer-X at gesture-start — pointermove subtracts to get DX. */
      startPointerX: number;
      /** Row's inside-width at gesture-start. Stable for the duration. */
      containerWidth: number;
      /** Last constraint hit — drives the constraint-snap pill + label. */
      constraintHit: ResizeConstraint;
      constraintBound: number;
      /** The captured pointer id — used to release setPointerCapture
       *  on end/cancel. */
      pointerId: number;
    };

/* ------------------------------------------------------------------ */
/* Singleton                                                            */
/* ------------------------------------------------------------------ */

const state = ref<ResizeState>({ kind: 'idle' });

/** Pending rAF id so we throttle pointermove to once per frame. */
let rafHandle: number | null = null;
/** The last pointerX seen during the throttled window — consumed by
 *  the next rAF tick. */
let pendingPointerX = 0;

/* ------------------------------------------------------------------ */
/* Document-handler lifecycle                                           */
/* ------------------------------------------------------------------ */

let getDraftClosure: (() => LayoutRecord | null) | null = null;

function onDocPointerMove(e: PointerEvent): void {
  if (state.value.kind !== 'idle' && e.pointerId === state.value.pointerId) {
    pendingPointerX = e.clientX;
    if (rafHandle === null && typeof window !== 'undefined') {
      rafHandle = window.requestAnimationFrame(() => {
        rafHandle = null;
        applyPointerX(pendingPointerX);
      });
    }
  }
}

function onDocPointerUp(e: PointerEvent): void {
  if (state.value.kind !== 'idle' && e.pointerId === state.value.pointerId) {
    endResize();
  }
}

function onDocPointerCancel(e: PointerEvent): void {
  if (state.value.kind !== 'idle' && e.pointerId === state.value.pointerId) {
    // Pointer was lost (window blur, touch interrupted). Same path as
    // endResize — commit the partial result. Cancelling silently could
    // strand the user with a half-applied resize they can't undo because
    // no command was recorded.
    endResize();
  }
}

function onDocKeyDown(e: KeyboardEvent): void {
  if (state.value.kind !== 'resizing') return;
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelResize();
  }
}

/**
 * R2-4 audit fix — Alt+Tab / window blur safety. If the user switches
 * tabs OR the document loses focus mid-drag, the document pointerup
 * may never fire (the OS handed events to the new window). Without a
 * watchdog, the resize state would stay `resizing` indefinitely — the
 * next pointermove ANYWHERE on the document would keep mutating the
 * draft until the user clicked again. Commit instead of cancel so the
 * partial state isn't lost (mirrors pointercancel's choice).
 *
 * `visibilitychange` also covers iOS Safari background-app eviction,
 * where the window doesn't lose focus traditionally but the document
 * stops receiving pointer events. Both cover overlapping but slightly
 * different states; cheap to register both.
 */
function onWindowBlur(): void {
  if (state.value.kind === 'resizing') endResize();
}
function onDocVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden' && state.value.kind === 'resizing') {
    endResize();
  }
}

function attachDocHandlers(): void {
  if (typeof window === 'undefined') return;
  document.addEventListener('pointermove', onDocPointerMove);
  document.addEventListener('pointerup', onDocPointerUp);
  document.addEventListener('pointercancel', onDocPointerCancel);
  document.addEventListener('keydown', onDocKeyDown);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onDocVisibilityChange);
}

function detachDocHandlers(): void {
  if (typeof window === 'undefined') return;
  document.removeEventListener('pointermove', onDocPointerMove);
  document.removeEventListener('pointerup', onDocPointerUp);
  document.removeEventListener('pointercancel', onDocPointerCancel);
  document.removeEventListener('keydown', onDocKeyDown);
  window.removeEventListener('blur', onWindowBlur);
  document.removeEventListener('visibilitychange', onDocVisibilityChange);
  if (rafHandle !== null) {
    window.cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}

/* ------------------------------------------------------------------ */
/* Live-preview tick                                                    */
/* ------------------------------------------------------------------ */

/** Read a pointerX, recompute the snapped delta, mutate the draft for
 *  live preview. Called from the rAF callback so reactivity batches. */
function applyPointerX(pointerX: number): void {
  if (state.value.kind !== 'resizing') return;
  if (!getDraftClosure) return;
  const draft = getDraftClosure();
  if (!draft) return;
  const s = state.value;

  const desiredDelta = computeSnappedColSpan(
    pointerX - s.startPointerX,
    s.containerWidth,
  );

  // No-op delta means no mutation needed — short-circuit so the watcher
  // doesn't fire spuriously on every micro-pixel pointermove.
  if (desiredDelta === s.currentColSpan - s.startColSpan
      && (s.neighbourId === null
          || s.neighbourCurrentColSpan === s.neighbourStartColSpan - (s.currentColSpan - s.startColSpan))) {
    return;
  }

  const clamped = clampResize({
    startColSpan: s.startColSpan,
    desiredDelta,
    sectionMin: s.sectionMin,
    sectionMax: s.sectionMax,
    neighbourStart: s.neighbourId === null ? null : s.neighbourStartColSpan,
    neighbourMin: s.neighbourMin,
    neighbourMax: s.neighbourMax,
  });

  // Apply to the live draft so the existing CSS render path picks up.
  const loc = findSectionLocation(draft, s.sectionId);
  if (loc) loc.section.colSpan = clamped.newColSpan;
  if (s.neighbourId !== null) {
    const nLoc = findSectionLocation(draft, s.neighbourId);
    if (nLoc) nLoc.section.colSpan = clamped.newNeighbourColSpan;
  }

  // Audit-of-audit: narrate the constraint hit on STATE TRANSITION
  // (null → bound). Without this, SR users get NO audio cue when a
  // pointer-drag pushes past a bound — `endResize`'s narrateResize fires
  // only at pointer-release. Narrating every frame would flood SR users
  // (60×/sec while held at the bound); narrating once-per-transition
  // matches Linear / Figma's resize behaviour. The visual constraint
  // label (aria-hidden) is the sighted-user signal.
  if (s.constraintHit === null && clamped.constraintHit !== null) {
    const ann = useLayoutAnnouncer();
    ann.announce(narrateResizeBlocked(
      s.sectionType,
      clamped.constraintHit,
      clamped.constraintBound,
    ));
  }

  // Update state machine — current values + constraint signal.
  s.currentColSpan = clamped.newColSpan;
  s.neighbourCurrentColSpan = s.neighbourId === null
    ? 0 : clamped.newNeighbourColSpan;
  s.constraintHit = clamped.constraintHit;
  s.constraintBound = clamped.constraintBound;
}

/* ------------------------------------------------------------------ */
/* Public API — start / end / cancel                                    */
/* ------------------------------------------------------------------ */

export interface StartResizeOpts {
  rowId: string;
  sectionId: string;
  sectionType: string;
  startColSpan: number;
  sectionMin: number;
  sectionMax: number;
  /** Null when the resized section is LAST in its row. */
  neighbourId: string | null;
  neighbourStartColSpan: number;
  neighbourMin: number;
  neighbourMax: number;
  /** Pointer coords at gesture-start. */
  startPointerX: number;
  pointerId: number;
  /** Row's inside-width at gesture-start. Stable for the duration. */
  containerWidth: number;
  /** Closure that returns the live draft. The composable holds it for
   *  the duration of the resize so pointermove can mutate. */
  getDraft: () => LayoutRecord | null;
  /** Optional handle element to setPointerCapture on. When provided,
   *  pointermove keeps firing on the handle even when the cursor leaves
   *  it (essential — without capture, dragging the handle off its 14px
   *  width loses the pointer). */
  captureEl?: HTMLElement | null;
}

function startResize(opts: StartResizeOpts): void {
  // If a previous resize is somehow still active (defensive), commit
  // it before starting a new one. Prevents two resizes mutating draft
  // simultaneously.
  if (state.value.kind !== 'idle') endResize();

  getDraftClosure = opts.getDraft;
  state.value = {
    kind: 'resizing',
    rowId: opts.rowId,
    sectionId: opts.sectionId,
    sectionType: opts.sectionType,
    startColSpan: opts.startColSpan,
    currentColSpan: opts.startColSpan,
    neighbourId: opts.neighbourId,
    neighbourStartColSpan: opts.neighbourStartColSpan,
    neighbourCurrentColSpan: opts.neighbourStartColSpan,
    sectionMin: opts.sectionMin,
    sectionMax: opts.sectionMax,
    neighbourMin: opts.neighbourMin,
    neighbourMax: opts.neighbourMax,
    startPointerX: opts.startPointerX,
    containerWidth: opts.containerWidth,
    constraintHit: null,
    constraintBound: 0,
    pointerId: opts.pointerId,
  };

  // setPointerCapture: keeps pointermove firing on the handle element
  // even when the cursor leaves it. Without capture, a fast drag past
  // the handle's 14px width loses the pointer + the resize freezes.
  // (Browsers without setPointerCapture support — none modern — fall
  // back to the document-level handlers which still fire on the body.)
  if (opts.captureEl && typeof opts.captureEl.setPointerCapture === 'function') {
    try {
      opts.captureEl.setPointerCapture(opts.pointerId);
    } catch {
      // Pointer capture can throw if the pointer was already released
      // (e.g. very fast click); not fatal — handlers still fire on doc.
    }
  }

  attachDocHandlers();
}

/** Commit the resize if it changed anything, then reset state to idle. */
function endResize(): void {
  if (state.value.kind !== 'resizing') return;
  const s = state.value;

  // No-op: pointer ended where it started (drag-back-to-original). Skip
  // the history record so the stack doesn't fill with self-equal entries.
  const sectionChanged = s.currentColSpan !== s.startColSpan;
  const neighbourChanged = s.neighbourId !== null
    && s.neighbourCurrentColSpan !== s.neighbourStartColSpan;

  if (sectionChanged || neighbourChanged) {
    const history = useLayoutHistory();
    history.record(resizeSectionCommand({
      rowId: s.rowId,
      sectionId: s.sectionId,
      fromColSpan: s.startColSpan,
      toColSpan: s.currentColSpan,
      neighbourId: s.neighbourId,
      neighbourFromColSpan: s.neighbourId === null
        ? undefined : s.neighbourStartColSpan,
      neighbourToColSpan: s.neighbourId === null
        ? undefined : s.neighbourCurrentColSpan,
      label: `resize ${s.sectionType}`,
    }));
    // Narrate the final span (pointer-up = end of gesture). The mid-drag
    // pointermove ticks DON'T narrate — that would flood SR users with
    // 60 announcements/sec. Narrating once at end matches the
    // drag-drop announcer's "announce on END not START" rule.
    const ann = useLayoutAnnouncer();
    ann.announce(narrateResize(s.sectionType, s.currentColSpan));
  }

  detachDocHandlers();
  getDraftClosure = null;
  state.value = { kind: 'idle' };
}

/** Revert the draft to start values + reset state. Esc keypress + (defensive)
 *  pointer-lost scenarios call this. NO history record — the draft never
 *  diverged from the user's perspective. */
function cancelResize(): void {
  if (state.value.kind !== 'resizing') return;
  const s = state.value;
  if (getDraftClosure) {
    const draft = getDraftClosure();
    if (draft) {
      const loc = findSectionLocation(draft, s.sectionId);
      if (loc) loc.section.colSpan = s.startColSpan;
      if (s.neighbourId !== null) {
        const nLoc = findSectionLocation(draft, s.neighbourId);
        if (nLoc) nLoc.section.colSpan = s.neighbourStartColSpan;
      }
    }
  }
  detachDocHandlers();
  getDraftClosure = null;
  state.value = { kind: 'idle' };
}

/* ------------------------------------------------------------------ */
/* Keyboard resize — Shift+Arrow                                        */
/* ------------------------------------------------------------------ */

export interface KeyboardResizeOpts {
  /** The row + section the keystroke applies to (looked up from the
   *  current selection by the caller). */
  rowId: string;
  sectionId: string;
  /** Direction: 'shrink' = Shift+Left = -1; 'grow' = Shift+Right = +1.
   *  Composable doesn't care about the actual key; the caller maps it. */
  direction: 'shrink' | 'grow';
  /** Closure to read the live draft (consistent with pointer path). */
  getDraft: () => LayoutRecord | null;
  /** Per-section bounds — typically read by the caller from the
   *  section registry. */
  sectionMin: number;
  sectionMax: number;
  /** Section type — used in narration. */
  sectionType: string;
  /** Right-neighbour bounds; pass null when the section is LAST in row. */
  neighbour: {
    sectionId: string;
    min: number;
    max: number;
  } | null;
}

export interface KeyboardResizeResult {
  /** The new span after the keystroke. Equal to the start when the
   *  keystroke hit a bound. */
  newColSpan: number;
  /** Which bound the keystroke hit, if any. */
  constraintHit: ResizeConstraint;
  /** The numeric bound (for narration). */
  constraintBound: number;
  /** Whether the keystroke produced a mutation worth recording. */
  changed: boolean;
}

/**
 * Apply a Shift+Arrow keyboard resize. ±1 column per press; same
 * neighbour-absorption rule as the pointer path. Commits one command
 * per keystroke (each press is a discrete user intent — unlike a
 * pointer drag where 60 ticks coalesce to ONE command at release).
 *
 * Narration:
 *   - changed=true → "Hero now spans N of 12 columns."
 *   - constraintHit → narrateResizeBlocked surface — names the bound.
 *
 * Returns the result so the caller can do its own follow-up (e.g. the
 * editor page might re-focus after the keystroke). The composable
 * handles history + narration itself.
 */
function applyKeyboardResize(opts: KeyboardResizeOpts): KeyboardResizeResult | null {
  const draft = opts.getDraft();
  if (!draft) return null;
  const loc = findSectionLocation(draft, opts.sectionId);
  if (!loc) return null;

  const startColSpan = loc.section.colSpan;
  const desiredDelta = opts.direction === 'grow' ? 1 : -1;

  // Resolve neighbour live (vs at registration). Keyboard presses are
  // discrete + spaced out; the neighbour may have changed since the
  // section was selected.
  const neighbourLoc = opts.neighbour
    ? findSectionLocation(draft, opts.neighbour.sectionId)
    : null;
  const neighbourStart = neighbourLoc ? neighbourLoc.section.colSpan : null;
  const neighbourMin = opts.neighbour?.min ?? 1;
  const neighbourMax = opts.neighbour?.max ?? 12;

  const clamped = clampResize({
    startColSpan,
    desiredDelta,
    sectionMin: opts.sectionMin,
    sectionMax: opts.sectionMax,
    neighbourStart,
    neighbourMin,
    neighbourMax,
  });

  const sectionChanged = clamped.newColSpan !== startColSpan;
  const neighbourChanged = neighbourLoc !== null
    && clamped.newNeighbourColSpan !== neighbourLoc.section.colSpan;

  const ann = useLayoutAnnouncer();

  if (!sectionChanged && !neighbourChanged) {
    // Pressed at the bound — narrate the block + return.
    if (clamped.constraintHit !== null) {
      ann.announce(narrateResizeBlocked(
        opts.sectionType,
        clamped.constraintHit,
        clamped.constraintBound,
      ));
    }
    return {
      newColSpan: startColSpan,
      constraintHit: clamped.constraintHit,
      constraintBound: clamped.constraintBound,
      changed: false,
    };
  }

  // Capture BEFORE-snapshot for the command (read live values so
  // intervening edits don't corrupt the invert).
  const neighbourFromColSpan = neighbourLoc?.section.colSpan;

  // Apply.
  loc.section.colSpan = clamped.newColSpan;
  if (neighbourLoc) {
    neighbourLoc.section.colSpan = clamped.newNeighbourColSpan;
  }

  // Record.
  const history = useLayoutHistory();
  history.record(resizeSectionCommand({
    rowId: opts.rowId,
    sectionId: opts.sectionId,
    fromColSpan: startColSpan,
    toColSpan: clamped.newColSpan,
    neighbourId: neighbourLoc ? opts.neighbour!.sectionId : null,
    neighbourFromColSpan,
    neighbourToColSpan: neighbourLoc ? clamped.newNeighbourColSpan : undefined,
    label: `resize ${opts.sectionType} (keyboard)`,
  }));

  // Narrate. If the keystroke hit a bound (e.g. shrank to min in a
  // direction that didn't have room for the full delta — rare edge),
  // narrate the bound FIRST, then the result.
  if (clamped.constraintHit !== null) {
    ann.announce(narrateResizeBlocked(
      opts.sectionType,
      clamped.constraintHit,
      clamped.constraintBound,
    ));
  } else {
    ann.announce(narrateResize(opts.sectionType, clamped.newColSpan));
  }

  return {
    newColSpan: clamped.newColSpan,
    constraintHit: clamped.constraintHit,
    constraintBound: clamped.constraintBound,
    changed: true,
  };
}

/* ------------------------------------------------------------------ */
/* Composable surface                                                   */
/* ------------------------------------------------------------------ */

export interface LayoutResize {
  /** Current state — `idle` or `resizing` with full gesture context.
   *  Read by LayoutSection (handle visual state) + LayoutRow (guide
   *  overlay). */
  state: Ref<ResizeState>;
  /** Begin a resize gesture from a pointerdown on the right-edge handle. */
  startResize: (opts: StartResizeOpts) => void;
  /** Commit + reset. Normally called by the document pointerup handler;
   *  exported so tests can drive without dispatching events. */
  endResize: () => void;
  /** Revert + reset. Esc keypress on a resize-in-flight; defensive
   *  pointer-lost recovery. */
  cancelResize: () => void;
  /** Apply a Shift+Arrow keyboard resize. */
  applyKeyboardResize: (opts: KeyboardResizeOpts) => KeyboardResizeResult | null;
  /** Helper for test fixtures + the LayoutSection handle's rendering —
   *  selects the right neighbour from a row's sections array. Returns
   *  null when the given section is LAST in the row. */
  findRightNeighbour: (sections: LayoutSection[], sectionId: string) => LayoutSection | null;
}

/** Right neighbour helper. Pure — exported for tests + the component's
 *  handle visibility logic. */
function findRightNeighbour(
  sections: LayoutSection[],
  sectionId: string,
): LayoutSection | null {
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx === -1 || idx === sections.length - 1) return null;
  return sections[idx + 1] ?? null;
}

export function useLayoutResize(): LayoutResize {
  return {
    state,
    startResize,
    endResize,
    cancelResize,
    applyKeyboardResize,
    findRightNeighbour,
  };
}
