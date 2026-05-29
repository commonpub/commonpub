<script setup lang="ts">
/**
 * <LayoutRow> — renders one row of a zone (a horizontal strip in the
 * 12-column grid) PLUS the sections inside it. Extracted from
 * <LayoutSlot> in Phase 3b/A so each row can own its own
 * `makeDroppable` template ref — dnd-kit composables can only be
 * called once per component instance, so one row instance per
 * component instance is the natural fit.
 *
 * Public render path: editable=false → makeDroppable is disabled +
 * tabindex/role/aria are unset on sections + no click handlers wire.
 * Byte-pattern identical to the inline render that used to live in
 * <LayoutSlot> (the existing LayoutSlot tests query for the same
 * .cpub-layout-row / .cpub-layout-section / data-* shape).
 *
 * Editable path: makeDroppable enabled; the row accepts palette tile
 * drops + (commit F) section-instance drops. Drop handling is
 * delegated to the pure `dispatchSectionDrop` function in
 * useLayoutDrag.ts — this component is wiring only.
 */
import { computed, ref } from 'vue';
import { makeDroppable, type IDragEvent } from '@vue-dnd-kit/core';
import type { LayoutSection, LayoutRow } from '../composables/useLayout';
import { useSectionRegistry } from '../sections/registry';
import type { EditorSelection } from '../composables/useLayoutEditor';
import { dispatchSectionDrop } from '../composables/useLayoutDrag';

const props = withDefaults(defineProps<{
  /** The row's reactive object — mutating row.sections here is picked
   *  up by the editor's deep watcher on draft (no callback needed). */
  row: LayoutRow;
  /** Forwarded from LayoutSlot — used by the section's render meta. */
  route: string;
  /** Zone slug — used by the section's render meta. */
  zone: string;
  /** When true, paint editor chrome + enable selection + makeDroppable. */
  editable?: boolean;
  /** True when the parent LayoutSlot has previewOverride — gates the
   *  section's meta.isPreview flag. */
  isPreview?: boolean;
  /** Selection callback — passed verbatim from LayoutSlot. */
  onSelect?: (selection: EditorSelection) => void;
  /** Currently-selected target. */
  selectedId?: EditorSelection | null;
}>(), {
  editable: false,
  isPreview: false,
  onSelect: undefined,
  selectedId: null,
});

const features = useFeatures();
const { isAuthenticated, user } = useAuth();
const sectionRegistry = useSectionRegistry();

function isFeatureOn(featureGate: string | undefined): boolean {
  if (!featureGate) return true;
  return (features.features.value as unknown as Record<string, boolean>)?.[featureGate] ?? false;
}

function currentRole(): string {
  if (!isAuthenticated.value) return 'anonymous';
  return user.value?.role ?? 'member';
}

function sectionVisible(s: LayoutSection): boolean {
  if (!s.enabled) return false;
  const v = s.visibility;
  if (!v) return true;
  if (v.features && v.features.some((f: string) => !isFeatureOn(f))) return false;
  if (v.roles && v.roles.length > 0 && !v.roles.includes(currentRole())) return false;
  return true;
}

function resolveColSpan(s: LayoutSection, viewport: 'lg' | 'md' | 'sm'): number {
  if (viewport === 'lg') return s.responsive?.lg ?? s.colSpan;
  if (viewport === 'md') return s.responsive?.md ?? s.responsive?.lg ?? s.colSpan;
  return s.responsive?.sm ?? 12;
}

function resolveSectionProps(section: LayoutSection): Record<string, unknown> {
  const def = sectionRegistry.get(section.type);
  if (!def) return {};
  const standardProps = {
    config: section.config,
    meta: {
      route: props.route,
      zone: props.zone,
      isPreview: props.isPreview,
      effectiveColSpan: resolveColSpan(section, 'lg'),
      sectionId: section.id,
    },
  };
  return def.propMap ? def.propMap(standardProps) : standardProps;
}

/* ----- Selection — click / Enter / Space activate ------------------ */

function onSectionActivate(section: LayoutSection): void {
  if (!props.editable) return;
  props.onSelect?.({ kind: 'section', id: section.id });
}

function isSectionSelected(section: LayoutSection): boolean {
  const sel = props.selectedId;
  return !!sel && sel.kind === 'section' && sel.id === section.id;
}

const rowIsSelected = computed<boolean>(() => {
  const sel = props.selectedId;
  return !!sel && sel.kind === 'row' && sel.id === props.row.id;
});

/* ----- makeDroppable wiring ---------------------------------------- */
/*
 *   `disabled` is a reactive ref so toggling editable on/off (e.g. via
 *   the toolbar) flips the row's droppability without remounting.
 *
 *   `groups: ['section']` — palette tiles + section instances share
 *   this group; cross-feature drags (theme tokens etc) won't accidentally
 *   land here.
 *
 *   `payload: () => props.row.sections` — dnd-kit's payload factory.
 *   Called per drag-tick so it always reads the LIVE sections array.
 *
 *   `isDragOver: ComputedRef<IPlacement | undefined>` — bound to a
 *   --over modifier class in commit G (drop indicator visuals).
 */
const rowRef = ref<HTMLElement | null>(null);
const dragDisabled = computed<boolean>(() => !props.editable);

function handleDrop(event: IDragEvent): void {
  // Delegate to the pure dispatcher — same function used by tests, so
  // the behavior matrix is exercised once + this component is wiring.
  dispatchSectionDrop(event, props.row);
}

const { isDragOver } = makeDroppable(
  rowRef,
  {
    disabled: dragDisabled,
    groups: ['section'],
    events: {
      onDrop: handleDrop,
    },
  },
  () => props.row.sections,
);

/** Exposed for the drop-indicator class binding in the template. */
const isOver = computed<boolean>(() => isDragOver.value !== undefined);
</script>

<template>
  <div
    ref="rowRef"
    class="cpub-layout-row"
    :class="{
      'cpub-layout-row--editable': editable,
      'cpub-layout-row--selected': editable && rowIsSelected,
      'cpub-layout-row--drop-over': editable && isOver,
    }"
    :data-row-id="row.id"
    :data-gap="row.config?.gap ?? 'md'"
    :data-align="row.config?.align ?? 'stretch'"
    :data-padding-y="row.config?.paddingY ?? 'none'"
    :style="row.config?.background ? { background: row.config.background } : {}"
  >
    <!--
      Section render — same shape as the pre-extraction LayoutSlot
      template so existing selectors / a11y scanners / tests don't
      have to chase a moving target.
    -->
    <div
      v-for="section in row.sections.filter(sectionVisible)"
      :key="section.id"
      class="cpub-layout-section"
      :class="{
        'cpub-layout-section--editable': editable,
        'cpub-layout-section--selected': editable && isSectionSelected(section),
      }"
      :data-section-id="section.id"
      :data-section-type="section.type"
      :data-hide-sm="section.visibility?.hideAt?.includes('sm') ? 'true' : 'false'"
      :data-hide-md="section.visibility?.hideAt?.includes('md') ? 'true' : 'false'"
      :data-hide-lg="section.visibility?.hideAt?.includes('lg') ? 'true' : 'false'"
      :style="{
        '--cpub-section-cols-sm': resolveColSpan(section, 'sm'),
        '--cpub-section-cols-md': resolveColSpan(section, 'md'),
        '--cpub-section-cols-lg': resolveColSpan(section, 'lg'),
      }"
      :tabindex="editable ? 0 : undefined"
      :role="editable ? 'button' : undefined"
      :aria-pressed="editable ? (isSectionSelected(section) ? 'true' : 'false') : undefined"
      :aria-label="editable ? `Select ${section.type} section` : undefined"
      @click.stop="onSectionActivate(section)"
      @keydown.enter.prevent="onSectionActivate(section)"
      @keydown.space.prevent.stop="onSectionActivate(section)"
    >
      <component
        v-if="sectionRegistry.has(section.type)"
        :is="sectionRegistry.get(section.type)!.component"
        v-bind="resolveSectionProps(section)"
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
  </div>
</template>

<style scoped>
/*
 * Phase 3b/A extraction: the .cpub-layout-row + .cpub-layout-section
 * chrome (previously inlined in LayoutSlot.vue's <style scoped>) moves
 * here because Vue scoped styles are component-instance-hashed — rules
 * in LayoutSlot wouldn't reach the markup LayoutRow renders. Keeping
 * them here scopes them correctly to the elements they target.
 * LayoutSlot now only styles its skeleton loader + placeholder.
 */
.cpub-layout-row {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-4);
  width: 100%;
}
.cpub-layout-row[data-gap='none'] { gap: 0; }
.cpub-layout-row[data-gap='sm']   { gap: var(--space-2); }
.cpub-layout-row[data-gap='md']   { gap: var(--space-4); }
.cpub-layout-row[data-gap='lg']   { gap: var(--space-6); }

.cpub-layout-row[data-align='center'] { align-items: center; }
.cpub-layout-row[data-align='start']  { align-items: start; }
.cpub-layout-row[data-align='stretch'] { align-items: stretch; }

.cpub-layout-row[data-padding-y='sm'] { padding-block: var(--space-2); }
.cpub-layout-row[data-padding-y='md'] { padding-block: var(--space-4); }
.cpub-layout-row[data-padding-y='lg'] { padding-block: var(--space-6); }
.cpub-layout-row[data-padding-y='xl'] { padding-block: var(--space-8); }

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
/* Editable-mode chrome — visual affordance only.                      */
/* Public render path (editable=false) is byte-pattern identical.      */
/* ------------------------------------------------------------------ */
.cpub-layout-row--editable { position: relative; }
.cpub-layout-row--editable:hover {
  outline: 1px dashed var(--border);
  outline-offset: 2px;
}

.cpub-layout-section--editable {
  position: relative;
  /* cursor: pointer — selection wired; cursor: grab arrives WITH
     makeDraggable on sections in commit F. */
  cursor: pointer;
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

/* Selection chrome (commit C) — 2px accent outline + pinned badge. */
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
.cpub-layout-row--selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ */
/* Phase 3b/A drop-target highlight. Light accent-bg flash when a      */
/* drag is over this row — sharper visual lands in commit G via the   */
/* placement-aware drop indicator. This is the baseline affordance.   */
/* ------------------------------------------------------------------ */
.cpub-layout-row--drop-over {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  outline: 2px dashed var(--accent);
  outline-offset: 4px;
}
</style>
