<script setup lang="ts">
/**
 * <AdminLayoutsPaletteTile> — a single section in the palette.
 *
 * Phase 3b/A: each tile owns its own `makeDraggable` template ref so
 * the palette can host N tiles, each a drag source. Mirrors the
 * <LayoutRow> per-iteration pattern: dnd-kit composables run per
 * component setup; the natural fit is one component instance per drag
 * source.
 *
 * The tile drags a `paletteDragPayload(def)` envelope (kind:
 * 'palette-section-spec'). On drop into a row, the row's makeDroppable
 * onDrop hands the payload to `dispatchSectionDrop`, which mints a
 * fresh section via `createSectionFromSpec`. Source + drop handler
 * stay in lockstep through the shared `useLayoutDrag` module.
 *
 * Visual identical to the inline tile this replaces — same class names,
 * same data attributes, same hover treatment. Only addition: cursor:
 * grab when wired (per `feedback-visual-editor-ux-patterns` cursor-as-
 * contract — grab is a PROMISE the drag actually works, and now it does).
 */
import { ref } from 'vue';
import { makeDraggable } from '@vue-dnd-kit/core';
import type { SectionDefinition } from '@commonpub/ui';
import { paletteDragPayload } from '../../../composables/useLayoutDrag';

const props = defineProps<{
  section: SectionDefinition;
}>();

const tileRef = ref<HTMLElement | null>(null);

// dnd-kit's payload factory takes [index, items]. A palette tile is
// effectively a single-item list (you can't "rearrange items within a
// palette tile") so index=0 + items=[envelope] is the canonical shape.
//
// The factory is invoked per drag-tick, so referencing `props.section`
// directly is fine — `paletteDragPayload` shallow-clones defaultConfig
// into the envelope so subsequent drags are independent.
makeDraggable(
  tileRef,
  {
    groups: ['section'],
  },
  () => [0, [paletteDragPayload(props.section)]],
);
</script>

<template>
  <li
    ref="tileRef"
    class="cpub-admin-layouts-palette-tile"
    :data-section-type="section.type"
    :data-section-status="section.status ?? 'stable'"
    :aria-label="`Drag to insert ${section.name} (${section.type}) section`"
    tabindex="0"
  >
    <i :class="['cpub-admin-layouts-palette-tile-icon', section.icon]"></i>
    <div class="cpub-admin-layouts-palette-tile-body">
      <span class="cpub-admin-layouts-palette-tile-name">{{ section.name }}</span>
      <span class="cpub-admin-layouts-palette-tile-desc">{{ section.description }}</span>
    </div>
    <span
      v-if="section.status === 'beta'"
      class="cpub-admin-layouts-palette-tile-badge"
    >beta</span>
  </li>
</template>

<style scoped>
/*
 * Tile chrome — visual treatment moves here from AdminLayoutsPalette
 * (Vue scoped styles are component-instance hashed). The palette's
 * own scoped styles handle the surrounding layout (group titles,
 * scroll container) — these handle the tile body itself.
 */
.cpub-admin-layouts-palette-tile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface2);
  border: 1px solid var(--border2);
  user-select: none;
  /*
   * cursor: grab. The drag is now wired — this isn't a UI lie. Per
   * `feedback-visual-editor-ux-patterns` cursor-as-contract:
   * `grab` reads "you can pick me up". A tile WITHOUT makeDraggable
   * should stay `cursor: default`; this one has it, so the cursor
   * promises something true.
   */
  cursor: grab;
}
.cpub-admin-layouts-palette-tile:active {
  /* `cursor: grabbing` during active drag — second half of the
     cursor-as-contract pattern. Pointer-state-driven (CSS :active fires
     on mousedown) is fine since dnd-kit's activation defaults are
     pointer-down + small distance. */
  cursor: grabbing;
}
.cpub-admin-layouts-palette-tile:hover {
  border-color: var(--border);
  background: var(--surface);
}
.cpub-admin-layouts-palette-tile:focus-visible {
  /* Keyboard-only focus ring — matches the editor's accent treatment
     elsewhere. WCAG 2.4.7 Focus Visible (AA). */
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.cpub-admin-layouts-palette-tile[data-section-status='deprecated'] { opacity: 0.5; }

.cpub-admin-layouts-palette-tile-icon {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.cpub-admin-layouts-palette-tile-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.cpub-admin-layouts-palette-tile-name { font-size: var(--text-sm); color: var(--text); }
.cpub-admin-layouts-palette-tile-desc {
  font-size: var(--text-xs);
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-admin-layouts-palette-tile-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: 1px var(--space-1);
  background: var(--accent-bg, var(--surface));
  color: var(--accent);
  border: 1px solid var(--accent);
}
</style>
