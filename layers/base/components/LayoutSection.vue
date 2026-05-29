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
import { ref, computed } from 'vue';
import { makeDraggable } from '@vue-dnd-kit/core';
import type { LayoutSection } from '../composables/useLayout';
import { useSectionRegistry } from '../sections/registry';
import type { EditorSelection } from '../composables/useLayoutEditor';
import type { SectionInstanceDragPayload } from '../composables/useLayoutDrag';

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
}>(), {
  editable: false,
  isPreview: false,
  onSelect: undefined,
  selectedId: null,
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

makeDraggable(
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
    :role="editable ? 'button' : undefined"
    :aria-pressed="editable ? (isSelected ? 'true' : 'false') : undefined"
    :aria-label="editable ? `Select ${section.type} section` : undefined"
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
</style>
