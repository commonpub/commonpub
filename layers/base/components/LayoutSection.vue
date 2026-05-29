<script setup lang="ts">
/**
 * <LayoutSection> — renders ONE section inside a row. Extracted from
 * <LayoutRow> in Phase 3b/A so each section can own its own
 * `makeDraggable` template ref (same per-iteration reasoning as the
 * <LayoutRow> + <AdminLayoutsPaletteTile> extractions before it).
 *
 * Public path (editable=false): renders the section as before — same
 * .cpub-layout-section class, same data-* attrs, no drag, no tabindex.
 * Editable path: tabindex='0', click→select, keyboard activate, the
 * 'cursor: grab' contract, makeDraggable wired with a section-instance
 * envelope that the row's dispatcher (commit 356e367) handles as a
 * within-row reorder.
 *
 * Mutations after drop flow through the row's makeDroppable onDrop
 * → dispatchSectionDrop, which mutates row.sections in place. No save
 * call from here; the editor's deep watcher picks it up.
 */
import { ref, computed, onBeforeUnmount, nextTick } from 'vue';
import { makeDraggable } from '@vue-dnd-kit/core';
import type { LayoutSection } from '../composables/useLayout';
import { useSectionRegistry } from '../sections/registry';
import type { EditorSelection } from '../composables/useLayoutEditor';
import type { SectionInstanceDragPayload } from '../composables/useLayoutDrag';
import { useLayoutResize } from '../composables/useLayoutResize';

const props = withDefaults(defineProps<{
  section: LayoutSection;
  /** The id of the row hosting this section — needed in the drag
   *  payload so the dispatcher can distinguish within-row reorder
   *  from cross-row move (deferred to 3b/B). */
  rowId: string;
  route: string;
  zone: string;
  editable?: boolean;
  isPreview?: boolean;
  onSelect?: (selection: EditorSelection) => void;
  selectedId?: EditorSelection | null;
  /**
   * Move Up — WCAG 2.1.1 non-drag keyboard path. The parent (LayoutRow)
   * passes a closure that mutates row.sections; this component only
   * fires the click. Absence = button hidden (defensive: editable=true
   * without the callbacks means a parent forgot to wire them, NOT an
   * intentional "no move" state).
   */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /**
   * Phase 3b/B — "Move to zone…" keyboard cross-zone path. The list
   * of OTHER zones the section can move to (current zone filtered out
   * + zones with no rows filtered out by the parent). Empty / undefined
   * → button hidden, no popover.
   *
   * Per the kickoff design pick (see session log): chosen over
   * focusable-zone-header + Cmd+Shift+Arrow chord because discoverability
   * matters more than economy — a single FAQ-able answer to "how do I
   * move with the keyboard" is the goal.
   */
  availableZones?: string[];
  /** Click handler — invoked with the target zone slug. The parent
   *  (LayoutRow) handles the splice + narration + history record. */
  onMoveToZone?: (targetZone: string) => void;
  /**
   * Phase 3c — resize handle pointerdown handler. The closure lives on
   * the parent <LayoutRow> because that's where the row's DOM element +
   * sibling sections (neighbour lookup) + registry-derived bounds are
   * naturally accessible. Absence = no handle rendered (parent decided
   * the section isn't resizable OR this is the public render path).
   *
   * Receives the raw PointerEvent so `useLayoutResize.startResize` can
   * capture pointer + read clientX. The handler is responsible for
   * `e.preventDefault()` so the gesture doesn't bubble into the
   * section's dnd-kit drag pickup or its `@click.stop` selection.
   */
  onResizeStart?: (e: PointerEvent) => void;
}>(), {
  editable: false,
  isPreview: false,
  onSelect: undefined,
  selectedId: null,
  onMoveUp: undefined,
  onMoveDown: undefined,
  availableZones: () => [],
  onMoveToZone: undefined,
  onResizeStart: undefined,
});

const sectionRegistry = useSectionRegistry();

/* ----- colSpan + propMap resolution (moved with the section) ------- */

function resolveColSpan(viewport: 'lg' | 'md' | 'sm'): number {
  const s = props.section;
  if (viewport === 'lg') return s.responsive?.lg ?? s.colSpan;
  if (viewport === 'md') return s.responsive?.md ?? s.responsive?.lg ?? s.colSpan;
  return s.responsive?.sm ?? 12;
}

const sectionProps = computed<Record<string, unknown>>(() => {
  const def = sectionRegistry.get(props.section.type);
  if (!def) return {};
  const standardProps = {
    config: props.section.config,
    meta: {
      route: props.route,
      zone: props.zone,
      isPreview: props.isPreview,
      effectiveColSpan: resolveColSpan('lg'),
      sectionId: props.section.id,
    },
  };
  return def.propMap ? def.propMap(standardProps) : standardProps;
});

/* ----- Selection ---------------------------------------------------- */

const isSelected = computed<boolean>(() => {
  const sel = props.selectedId;
  return !!sel && sel.kind === 'section' && sel.id === props.section.id;
});

function activate(): void {
  if (!props.editable) return;
  props.onSelect?.({ kind: 'section', id: props.section.id });
}

/* ----- makeDraggable ----------------------------------------------- */
/*
 *  disabled: !editable so the composable is registered unconditionally
 *  (Vue rules-of-hooks) but inert on the public path.
 *
 *  groups: ['section'] matches both the palette tile + the row drop
 *  zone. dnd-kit's group-matching ensures a section can't drop into
 *  the palette or a non-section drop zone.
 *
 *  payload returns a section-instance envelope — the dispatcher knows
 *  to splice-remove + splice-insert for sameList reorder, or noop for
 *  cross-row drops in 3b/A (cross-zone arrives in 3b/B).
 */
const sectionRef = ref<HTMLElement | null>(null);
const dragDisabled = computed<boolean>(() => !props.editable);

const { isDragOver } = makeDraggable(
  sectionRef,
  {
    groups: ['section'],
    disabled: dragDisabled,
  },
  () => [
    0,
    [
      {
        kind: 'section-instance',
        section: props.section,
        fromRowId: props.rowId,
      } satisfies SectionInstanceDragPayload,
    ],
  ],
);

/**
 * Session 164 polish — placement-aware drop indicator (plan §7.4).
 *
 * When a drag is held over THIS section, dnd-kit's `isDragOver` carries
 * an `IPlacement` describing which side the cursor is on. We translate
 * that into a 'before' / 'after' / null tri-state, then bind two CSS
 * classes that paint a 2px accent line on the section's left or right
 * edge — showing the admin EXACTLY where the drop will land.
 *
 * Rows are horizontal, so `left` and `right` are the primary signals.
 * Session 164 audit R2-2: dnd-kit's pointer math falls back to `top` /
 * `bottom` flags whenever the hovered element's bounding rect is taller
 * than wide (e.g. a section that wrapped to two grid lines, or any
 * future vertical row). `useLayoutDrag.computeInsertIndex` already
 * honors them — the indicator MUST match or it lies about where the
 * drop will land. Mirror that logic here.
 *
 * No animation framework: box-shadow + 100ms opacity transition. The
 * indicator vanishes the moment the cursor leaves the section. FLIP
 * transitions on the section list use `transform`, which doesn't
 * conflict with box-shadow. prefers-reduced-motion disables the fade.
 */
const dropIndicatorSide = computed<'before' | 'after' | null>(() => {
  const placement = isDragOver.value;
  if (!placement) return null;
  if (placement.left || placement.top) return 'before';
  if (placement.right || placement.bottom) return 'after';
  return null;
});

/* ----- Move to zone … popover (Phase 3b/B) ------------------------- */
/*
 * Disclosure pattern: button toggles a small inline menu listing the
 * available target zones. Single-select (one click → move + close).
 * Esc closes; click-outside closes; focus returns to the trigger on
 * close so keyboard users don't lose context.
 *
 * Why not a dropdown library? The list is 1-3 items (we have 3 zones
 * total: full-width / main / sidebar). A 5-line inline popover keeps
 * bundle + maintenance overhead at zero.
 */
const moveMenuOpen = ref<boolean>(false);
const moveMenuTrigger = ref<HTMLButtonElement | null>(null);
const moveMenuPanel = ref<HTMLElement | null>(null);

function toggleMoveMenu(): void {
  moveMenuOpen.value = !moveMenuOpen.value;
  // When opening, move focus into the panel so keyboard users can
  // immediately Tab through the zone options. Done in nextTick so the
  // panel is rendered first.
  if (moveMenuOpen.value) {
    void nextTick().then(() => {
      const firstBtn = moveMenuPanel.value?.querySelector<HTMLButtonElement>('button');
      firstBtn?.focus();
    });
  }
}

function closeMoveMenu(): void {
  moveMenuOpen.value = false;
  // Return focus to the trigger so keyboard navigation stays predictable.
  moveMenuTrigger.value?.focus();
}

function chooseMoveTarget(zone: string): void {
  props.onMoveToZone?.(zone);
  moveMenuOpen.value = false;
  // After move, the section's DOM may be re-keyed under a new row
  // (Vue's v-for keying). Don't try to focus the trigger — it may
  // already be unmounted. Focus management for the moved section's
  // new location is the editor's responsibility (out of scope for
  // 3b/B; selection follows the section via the existing select
  // callback in a future polish).
}

function onMoveMenuKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeMoveMenu();
  }
}

/* R1 audit P2 fix: keyboard users who Tab past the last menu item
 * would leave focus elsewhere on the page while the popover stayed
 * open. focusout fires whenever focus leaves the panel; relatedTarget
 * is the new focus destination. If that destination is OUTSIDE both
 * the panel AND the trigger button, close. (Inside the trigger is
 * fine — clicking trigger again toggles via its own handler.) */
function onMoveMenuFocusOut(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  if (!next) {
    // Focus moved to nothing (e.g. clicking outside the document).
    // Treat as outside.
    moveMenuOpen.value = false;
    return;
  }
  if (moveMenuPanel.value?.contains(next)) return;
  if (moveMenuTrigger.value?.contains(next)) return;
  moveMenuOpen.value = false;
}

/* Click-outside dismissal. Attached to document on open, removed on
 * close + unmount. The condition `!panel.contains(target) && target !==
 * trigger` allows clicks on the trigger itself to handle the toggle
 * (otherwise the toggle would close, then the click handler would
 * re-open — flicker). */
function onDocumentPointerDown(e: PointerEvent): void {
  if (!moveMenuOpen.value) return;
  const target = e.target as Node | null;
  if (!target) return;
  if (moveMenuPanel.value?.contains(target)) return;
  if (moveMenuTrigger.value?.contains(target)) return;
  moveMenuOpen.value = false;
}
if (typeof window !== 'undefined') {
  document.addEventListener('pointerdown', onDocumentPointerDown);
}
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
  }
});

const hasMoveTargets = computed<boolean>(() =>
  !!props.onMoveToZone && props.availableZones.length > 0,
);

/* ----- Resize handle wiring (Phase 3c) --------------------------------- */
/*
 * Handle visibility: editable + parent passed a handler. The parent
 * (LayoutRow) only passes a handler when the section's registry def
 * has `resizable: true` AND the row is wider than its mobile breakpoint
 * (plan §7.5 — resize is disabled on < 768px). Section-side check is
 * thin: render IFF the prop is present. CSS hides the handle at < 768px
 * defensively in case a layout author passes the handler anyway.
 *
 * The pointerdown attribute is captured WITH passive=false (default for
 * `.passive` modifier absence) so we can preventDefault and consume
 * the gesture before dnd-kit's listener on the root element fires.
 */
const resize = useLayoutResize();
const hasResizeHandle = computed<boolean>(
  () => props.editable && typeof props.onResizeStart === 'function',
);

/** Is THIS section currently being resized? Drives the live pill + the
 *  "dim move buttons during resize" rule below. */
const isResizing = computed<boolean>(() => {
  const s = resize.state.value;
  return s.kind === 'resizing' && s.sectionId === props.section.id;
});

/** Is THIS section the right-neighbour absorbing the resize? Drives the
 *  dimmed neighbour pill so the user can see both spans update together. */
const isResizeNeighbour = computed<boolean>(() => {
  const s = resize.state.value;
  return s.kind === 'resizing' && s.neighbourId === props.section.id;
});

/** Span text the pill renders. During a resize, follows the live
 *  state; otherwise echoes the section's own colSpan so the pill stays
 *  meaningful as a static badge when selected. */
const liveSpanText = computed<string>(() => {
  const s = resize.state.value;
  if (s.kind === 'resizing' && s.sectionId === props.section.id) {
    return `${s.currentColSpan}/12`;
  }
  if (s.kind === 'resizing' && s.neighbourId === props.section.id) {
    return `${s.neighbourCurrentColSpan}/12`;
  }
  return `${props.section.colSpan}/12`;
});

/** Constraint-snap label — only shown while resizing + a bound was hit.
 *  Mirrors `narrateResizeBlocked`'s wording in compact visual form. */
const constraintLabel = computed<string | null>(() => {
  const s = resize.state.value;
  if (s.kind !== 'resizing') return null;
  if (s.sectionId !== props.section.id) return null;
  if (s.constraintHit === null) return null;
  if (s.constraintHit === 'section-min') return `🔒 min ${s.constraintBound}/12`;
  if (s.constraintHit === 'section-max') return `🔒 max ${s.constraintBound}/12`;
  return `🔒 next at ${s.constraintBound}/12`;
});

/** Direct pointerdown wrapper — stops bubbling so the section's own
 *  drag-pickup (dnd-kit) + click (selection) don't fire. */
function onHandlePointerDown(e: PointerEvent): void {
  if (!props.onResizeStart) return;
  // Only respond to primary button (mouse) OR any touch/pen. Right-click
  // on the handle shouldn't start a resize.
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  props.onResizeStart(e);
}

/* ----- Visibility -------------------------------------------------- */
/* hideAt is applied via CSS data-* attrs; the parent already filters
   enabled + visibility.roles + visibility.features. */
</script>

<template>
  <div
    ref="sectionRef"
    class="cpub-layout-section"
    :class="{
      'cpub-layout-section--editable': editable,
      'cpub-layout-section--selected': editable && isSelected,
      'cpub-layout-section--drop-before': editable && dropIndicatorSide === 'before',
      'cpub-layout-section--drop-after': editable && dropIndicatorSide === 'after',
    }"
    :data-section-id="section.id"
    :data-section-type="section.type"
    :data-hide-sm="section.visibility?.hideAt?.includes('sm') ? 'true' : 'false'"
    :data-hide-md="section.visibility?.hideAt?.includes('md') ? 'true' : 'false'"
    :data-hide-lg="section.visibility?.hideAt?.includes('lg') ? 'true' : 'false'"
    :style="{
      '--cpub-section-cols-sm': resolveColSpan('sm'),
      '--cpub-section-cols-md': resolveColSpan('md'),
      '--cpub-section-cols-lg': resolveColSpan('lg'),
    }"
    :tabindex="editable ? 0 : undefined"
    :aria-label="editable
      ? (isSelected ? `Selected: ${section.type} section` : `Select ${section.type} section`)
      : undefined"
    @click.stop="activate"
    @keydown.enter.prevent="activate"
    @keydown.space.prevent.stop="activate"
  >
    <component
      v-if="sectionRegistry.has(section.type)"
      :is="sectionRegistry.get(section.type)!.component"
      v-bind="sectionProps"
    />
    <div
      v-else
      class="cpub-layout-section-placeholder"
      :aria-label="`Unregistered section type: ${section.type}`"
    >
      <code>{{ section.type }}</code>
      <span class="cpub-layout-section-placeholder-hint">section type not registered</span>
    </div>

    <!--
      Phase 3b/A: WCAG 2.1.1 Level A non-drag keyboard path. Two
      buttons in the section's top-right corner. Always visible in
      editable mode (per feedback-visual-editor-ux-patterns: SR users
      need an always-discoverable alternative; revealing on hover hides
      it from keyboard users + assistive tech). Sized 28×28 minimum
      per the same memory (WCAG 2.5.8's 24×24 is the bare floor, not
      the design target).
      `@click.stop` prevents the click bubbling to the section's own
      click handler (which would set selection); the move IS the user's
      intent, not selection. `@keydown.space.stop` prevents the dnd-kit
      keyboard sensor from interpreting Space-on-button as a drag
      pickup of the section.
    -->
    <div v-if="editable && (onMoveUp || onMoveDown || hasMoveTargets)" class="cpub-layout-section-moves">
      <button
        v-if="onMoveUp"
        type="button"
        class="cpub-layout-section-move"
        :aria-label="`Move ${section.type} up`"
        @click.stop="onMoveUp"
        @keydown.space.stop
        @keydown.enter.stop
      >
        <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
      </button>
      <button
        v-if="onMoveDown"
        type="button"
        class="cpub-layout-section-move"
        :aria-label="`Move ${section.type} down`"
        @click.stop="onMoveDown"
        @keydown.space.stop
        @keydown.enter.stop
      >
        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </button>
      <!--
        Phase 3b/B — "Move to zone…" disclosure. Renders only when the
        parent provided a non-empty availableZones list (current zone
        excluded, zones with zero rows excluded). aria-haspopup='menu'
        + aria-expanded so screen readers announce the disclosure state;
        aria-controls links to the panel id for assistive tech
        traversal.
      -->
      <button
        v-if="hasMoveTargets"
        ref="moveMenuTrigger"
        type="button"
        class="cpub-layout-section-move"
        :aria-label="`Move ${section.type} to another zone`"
        aria-haspopup="menu"
        :aria-expanded="moveMenuOpen ? 'true' : 'false'"
        :aria-controls="`cpub-move-menu-${section.id}`"
        @click.stop="toggleMoveMenu"
        @keydown.space.stop.prevent="toggleMoveMenu"
        @keydown.enter.stop.prevent="toggleMoveMenu"
      >
        <i class="fa-solid fa-arrows-up-down-left-right" aria-hidden="true"></i>
      </button>
      <div
        v-if="moveMenuOpen"
        :id="`cpub-move-menu-${section.id}`"
        ref="moveMenuPanel"
        class="cpub-layout-section-move-menu"
        role="menu"
        :aria-label="`Move ${section.type} to zone`"
        @click.stop="(e: Event) => e.stopPropagation()"
        @keydown="onMoveMenuKey"
        @focusout="onMoveMenuFocusOut"
      >
        <button
          v-for="zone in availableZones"
          :key="zone"
          type="button"
          role="menuitem"
          class="cpub-layout-section-move-menu-item"
          @click.stop="chooseMoveTarget(zone)"
        >
          <i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i>
          <span>{{ zone }}</span>
        </button>
      </div>
    </div>

    <!--
      Phase 3c — right-edge resize handle.
      Renders only when the parent (LayoutRow) passes onResizeStart —
      that's the parent's signal that the section's registry def is
      `resizable: true` AND the row is wider than the mobile breakpoint
      (CSS further hides at < 768px defensively).

      The button is the SAME DOM subtree as the move-buttons cluster
      but sits at the right edge instead of top-right. dnd-kit's
      pointerdown is on the OUTER .cpub-layout-section root; this
      handle's pointerdown handler stops propagation so the section's
      drag pickup doesn't fire while resizing.

      `aria-label` includes both intent + current state ("Resize hero
      section, currently 8 of 12 columns") so SR users hear the live
      span without depending on the visual pill. State-in-name pattern
      per feedback-aria-selected-needs-role.
    -->
    <button
      v-if="hasResizeHandle"
      type="button"
      class="cpub-layout-section-resize-handle"
      :class="{
        'cpub-layout-section-resize-handle--active': isResizing,
      }"
      :aria-label="`Resize ${section.type} section, currently ${section.colSpan} of 12 columns. Hold and drag, or use Shift plus Arrow Left or Right while focused on this section.`"
      :title="`Drag to resize · ${section.colSpan}/12`"
      @pointerdown="onHandlePointerDown"
      @click.stop
      @keydown.space.stop
      @keydown.enter.stop
    >
      <!-- Two parallel lines mimic the convention from Figma / Webflow /
           Framer / Linear: vertical grip indicating "draggable edge". -->
      <i class="fa-solid fa-grip-lines-vertical" aria-hidden="true"></i>
    </button>

    <!--
      Phase 3c — live span pill. Shown while the section is selected OR
      involved in an in-flight resize. Three-state visual:
        - selected only: subtle outline-style badge "8/12"
        - resizing (this section): accent-filled, follows live span
        - neighbour during resize: dim variant, shows neighbour's live span
      Sighted users get the same fact SR users hear via narrateResize.
    -->
    <div
      v-if="editable && (isSelected || isResizing || isResizeNeighbour)"
      class="cpub-layout-section-span-pill"
      :class="{
        'cpub-layout-section-span-pill--active': isResizing,
        'cpub-layout-section-span-pill--neighbour': isResizeNeighbour,
      }"
      aria-hidden="true"
    >
      {{ liveSpanText }}
    </div>

    <!--
      Phase 3c — constraint snap label. Shown ONLY while THIS section is
      being resized AND a bound was hit. Provides the three independent
      signals plan §7.5 + WCAG 1.4.1 require: outline color change (the
      handle's --active state), lock icon ("🔒"), text ("min 3/12").
      Floats just below the span pill so colour-blind / sighted users
      have all three at once.

      `aria-hidden="true"`: this label is a VISUAL cue only. The audio
      channel is already covered by the announcer's
      narrateResizeBlocked (assertive), fired from useLayoutResize.
      Adding `aria-live="polite"` here would double-narrate the bound
      to screen readers (audit R1-1).
    -->
    <div
      v-if="constraintLabel"
      class="cpub-layout-section-constraint-label"
      aria-hidden="true"
    >
      {{ constraintLabel }}
    </div>
  </div>
</template>

<style scoped>
/*
 * Section chrome — moved here from LayoutRow because Vue scoped styles
 * hash by component instance + LayoutRow rendering <LayoutSection>
 * components wouldn't reach their .cpub-layout-section markup.
 */
.cpub-layout-section {
  grid-column: span var(--cpub-section-cols-lg, 12);
  min-width: 0;
}
@media (max-width: 1024px) {
  .cpub-layout-section { grid-column: span var(--cpub-section-cols-md, var(--cpub-section-cols-lg, 12)); }
}
@media (max-width: 640px) {
  .cpub-layout-section { grid-column: span var(--cpub-section-cols-sm, 12); }
}

.cpub-layout-section[data-hide-sm='true'] { @media (max-width: 640px) { display: none; } }
.cpub-layout-section[data-hide-md='true'] { @media (min-width: 641px) and (max-width: 1024px) { display: none; } }
.cpub-layout-section[data-hide-lg='true'] { @media (min-width: 1025px) { display: none; } }

.cpub-layout-section-placeholder {
  padding: var(--space-4);
  background: var(--surface2);
  border: 1px dashed var(--border2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.cpub-layout-section-placeholder code { color: var(--accent); }
.cpub-layout-section-placeholder-hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

/* ------------------------------------------------------------------ */
/* Editable-mode chrome — same treatment as before the extraction but */
/* WITH the `cursor: grab` contract finally lit up (makeDraggable is  */
/* wired in this commit, so the cursor is no longer a UI lie).        */
/* ------------------------------------------------------------------ */
.cpub-layout-section--editable {
  position: relative;
  cursor: grab;
}
.cpub-layout-section--editable:active {
  cursor: grabbing;
}

/*
 * Session 164 polish — inert content in editable mode (fixes the
 * pre-existing 3a "clicking Hero CTA navigates away from the editor"
 * bug + every variant of it across all 21 sections).
 *
 * The section's outer wrapper handles selection (click) + drag pickup
 * (pointerdown via makeDraggable). The inner content — rendered by
 * <component :is="..."> from the registry — frequently contains
 * <NuxtLink>s (Hero CTA, FeedItem cards, etc) that would otherwise
 * navigate the admin AWAY from /admin/layouts/[id] on any click.
 *
 * Pointer-events: none on the rendered content makes it transparent
 * to mouse events; clicks fall through to the section's outer wrapper
 * (selection). The moves cluster + popover stay interactive via their
 * own ":not()" carve-out. The drag pickup still works because dnd-kit
 * binds to the OUTER element, not inner content.
 *
 * One CSS rule replaces the alternative — drilling `isPreview` through
 * propMap on all 21 sections + adding navigation guards inside each.
 * (Per session 163's "reuse existing components" memory: the layout
 * engine is an ARRANGER for existing components; we shouldn't fork
 * each section just for editable-mode behavior.)
 *
 * Text selection inside the preview is also blocked — fine for v1; the
 * admin uses the inspector (Phase 3e) to edit copy, not in-canvas
 * direct manipulation. (Phase 3f's inline-edit affordance can carve
 * out specific zones if needed.)
 */
/* Session 166 round-2 audit P0: the resize handle (Phase 3c) is a
 * direct child of .cpub-layout-section--editable too. Without an
 * explicit :not(), this cascade makes it hit-test-invisible — clicks
 * + pointerdowns drop to the section's outer wrapper instead of
 * firing on the handle. Tests don't catch it (jsdom dispatchEvent
 * bypasses pointer-events hit testing); only a real browser does.
 * Adding the carve-out matches the established "interactive editor
 * chrome opts out" pattern (.cpub-layout-section-moves did the same
 * thing).
 *
 * The span pill + constraint label DO want pointer-events:none
 * (they're aria-hidden visual badges that shouldn't intercept
 * clicks on the section content beneath), so they're NOT carved out
 * here — each sets pointer-events:none explicitly below for clarity. */
.cpub-layout-section--editable > *:not(.cpub-layout-section-moves):not(.cpub-layout-section-resize-handle) {
  pointer-events: none;
}
.cpub-layout-section--editable:hover {
  outline: 1px dashed var(--border2);
  outline-offset: -1px;
}
.cpub-layout-section--editable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.cpub-layout-section--editable::after {
  content: attr(data-section-type);
  position: absolute;
  top: 0;
  left: 0;
  padding: var(--space-1) var(--space-2);
  background: var(--surface2);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: 1px solid var(--border2);
  border-top: 0;
  border-left: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 100ms ease-out;
  z-index: 1;
}
.cpub-layout-section--editable:hover::after { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-section--editable::after { transition: none; }
}

.cpub-layout-section--selected {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
.cpub-layout-section--selected::after {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
  opacity: 1;
}

/* ------------------------------------------------------------------ */
/* Session 164 — placement-aware drop indicators (plan §7.4).           */
/* 2px accent line on left/right edge during drag-over. Box-shadow      */
/* keeps the section's layout box unchanged + plays well with FLIP's    */
/* transform animations. 100ms fade matches the existing chrome timing. */
/* ------------------------------------------------------------------ */
.cpub-layout-section--drop-before {
  box-shadow: -3px 0 0 0 var(--accent);
  transition: box-shadow 100ms ease-out;
}
.cpub-layout-section--drop-after {
  box-shadow: 3px 0 0 0 var(--accent);
  transition: box-shadow 100ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-section--drop-before,
  .cpub-layout-section--drop-after {
    transition: none;
  }
}

/* ------------------------------------------------------------------ */
/* Move Up / Move Down — non-drag a11y path (WCAG 2.1.1 Level A).      */
/* Top-right corner mirror of the type-label badge (top-left).         */
/* 28×28 touch targets per feedback-visual-editor-ux-patterns.         */
/* Always visible in editable mode — discoverability for keyboard +    */
/* SR users is the entire point of this control.                       */
/* ------------------------------------------------------------------ */
.cpub-layout-section-moves {
  position: absolute;
  /* Inset 2px so the buttons don't visually kiss the section's
     2px --selected outline (audit R4-4). */
  top: 2px;
  right: 2px;
  display: flex;
  gap: 1px;
  z-index: 2;
  pointer-events: auto;
}
.cpub-layout-section-move {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--surface2);
  color: var(--text-dim);
  border: 1px solid var(--border2);
  border-top: 0;
  border-right: 0;
  cursor: pointer;
  font-size: var(--text-sm);
}
.cpub-layout-section-move:hover {
  background: var(--surface);
  color: var(--text);
}
.cpub-layout-section-move:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  /* Bring the focused button to the top so the outline isn't clipped
     by the section's own outline. */
  z-index: 3;
}

/* ------------------------------------------------------------------ */
/* Phase 3b/B — "Move to zone…" popover. Anchored below the trigger    */
/* button group. Same surface/border tokens as the move buttons so it  */
/* reads as a single chrome cluster.                                   */
/* ------------------------------------------------------------------ */
.cpub-layout-section-move-menu {
  position: absolute;
  top: 30px; /* below the 28px button row + 2px gap */
  right: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  min-width: 140px;
  /* Sits above sibling sections; the section-moves cluster is z-index:2
     so the menu needs higher. */
  z-index: 4;
}
.cpub-layout-section-move-menu-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 0;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
  text-align: left;
}
.cpub-layout-section-move-menu-item:hover {
  background: var(--accent-bg);
  color: var(--accent);
}
.cpub-layout-section-move-menu-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.cpub-layout-section-move-menu-item i { color: var(--text-dim); }
.cpub-layout-section-move-menu-item:hover i { color: var(--accent); }

/* ------------------------------------------------------------------ */
/* Phase 3c — Resize handle on the section's right edge.                */
/* Slim vertical strip (4px wide), centered on the section's right      */
/* border. Touch target is enlarged via padding on the inner button     */
/* so the visible affordance stays minimal but WCAG 2.5.8 (24×24)       */
/* is satisfied. col-resize cursor establishes the contract.            */
/*                                                                      */
/* Hover/selection reveals; default is 0 opacity so the canvas isn't    */
/* visually noisy when nothing's selected. Visible during a resize-in-  */
/* flight via the --active modifier (the gesture's own owning section). */
/*                                                                      */
/* < 768px: hidden per plan §7.5. The inspector slider becomes the      */
/* colSpan path on small viewports (Phase 3e ships it; for now the      */
/* handle's just absent on mobile + the move buttons still work).       */
/* ------------------------------------------------------------------ */
.cpub-layout-section-resize-handle {
  position: absolute;
  /* Centered on the section's right border. -2px so the 4px-wide handle
     sits half-in/half-out — reads as "the border itself is the grip". */
  top: 50%;
  right: -2px;
  transform: translateY(-50%);
  /* Visible affordance is 4×56 (slim strip). Inner padding bumps the
     hit area to ≥24×24 per WCAG without bloating the visual. */
  width: 4px;
  height: 56px;
  /* Pad the click target — inset shadow doesn't grow visually; the
     element's box-sizing makes click area = width + padding-x*2. */
  padding: 0 12px;
  background: var(--accent);
  border: 0;
  cursor: col-resize;
  /* Above section content so the user can grab it even with overlapping
     hover affordances; below the move-buttons cluster (z=2) + the move
     popover (z=4) so disclosure UIs win conflicts. */
  z-index: 1;
  /* Hover/focus/active reveal — opacity 0 by default so the canvas is
     visually quiet when nothing's selected. */
  opacity: 0;
  transition: opacity 100ms ease-out;
  /* The icon's contained inside the inner 4px strip — center it. */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--surface);
  font-size: 10px;
}
.cpub-layout-section-resize-handle i {
  /* The grip lines icon — visible only when handle is. Keeps the
     touch target generous without taking visual space. */
  line-height: 1;
  pointer-events: none;
}
/* Reveal on the section's hover, selection, or focus-within (keyboard
   user tabbed to a child) — the union covers all input modes. */
.cpub-layout-section--editable:hover > .cpub-layout-section-resize-handle,
.cpub-layout-section--selected > .cpub-layout-section-resize-handle,
.cpub-layout-section--editable:focus-within > .cpub-layout-section-resize-handle,
.cpub-layout-section-resize-handle--active,
.cpub-layout-section-resize-handle:focus-visible {
  opacity: 1;
}
.cpub-layout-section-resize-handle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* During an active resize, fatten the strip so the visual matches the
   "I'm gripping this" gesture + adds the third independent signal
   (alongside color + lock icon) that constraint-snap relies on. */
.cpub-layout-section-resize-handle--active {
  width: 6px;
  right: -3px;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-section-resize-handle { transition: none; }
}
/* < 768px: hide the handle per plan §7.5. Colspan changes happen via
   the inspector slider on mobile (deferred to Phase 3e — keyboard
   path via Shift+Arrow still works in the meantime). */
@media (max-width: 768px) {
  .cpub-layout-section-resize-handle { display: none; }
}

/* ------------------------------------------------------------------ */
/* Phase 3c — Live span pill.                                           */
/* Anchored top-right INSIDE the section (under the move-buttons        */
/* cluster). Three states:                                              */
/*   - default (selected only): outline-style "8/12" badge              */
/*   - --active (this section is being resized): accent-filled          */
/*   - --neighbour (this section is absorbing the resize delta): dim    */
/* ------------------------------------------------------------------ */
.cpub-layout-section-span-pill {
  position: absolute;
  /* Below the moves cluster so they don't overlap. moves is at top:2 +
     28px tall + 2 gap = 32. Pill sits at top:36 with a bit of breathing
     room. */
  top: 36px;
  right: 2px;
  padding: 2px var(--space-2);
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  /* Above the rendered section content (which is pointer-events:none)
     but below the moves cluster. */
  z-index: 2;
  pointer-events: none;
  /* Compactness: pill should read as ONE word "8/12" not a multi-line
     wrap on narrow sections. */
  white-space: nowrap;
}
.cpub-layout-section-span-pill--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
  /* Subtle scale to draw the eye during the active resize. Skipped
     under prefers-reduced-motion. */
  transform: scale(1.05);
  transition: transform 100ms ease-out;
}
.cpub-layout-section-span-pill--neighbour {
  /* Dim variant — clearly visible but not competing with the active
     pill's accent. Mirrors plan §7.5 "neighbour's pill 4/12, dimmed". */
  opacity: 0.65;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-section-span-pill--active { transition: none; transform: none; }
}

/* ------------------------------------------------------------------ */
/* Phase 3c — Constraint-snap label.                                    */
/* Below the active pill, shows the bound the user pushed against. The  */
/* lock emoji + bound number give two more independent signals beyond   */
/* the handle's color change → three total per WCAG 1.4.1.              */
/* ------------------------------------------------------------------ */
.cpub-layout-section-constraint-label {
  position: absolute;
  /* Below the span pill (which is at top:36 + 2+2*2+font-size ~24 tall
     = ~62). 64 leaves a 2px gap. */
  top: 64px;
  right: 2px;
  padding: 2px var(--space-2);
  background: var(--red, var(--accent));
  color: var(--surface);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  z-index: 2;
  pointer-events: none;
  white-space: nowrap;
}
</style>
