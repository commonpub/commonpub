<script setup lang="ts">
/**
 * &lt;LayoutSlot&gt; — renders one zone of a route's active layout.
 *
 * Page (e.g. `pages/index.vue`) is the FRAME; this component is the
 * fillings for each zone the page exposes. Pages declare zones like:
 *
 * ```vue
 * &lt;template&gt;
 *   &lt;LayoutSlot route="/" zone="full-width" /&gt;
 *   &lt;div class="cpub-content-grid"&gt;
 *     &lt;LayoutSlot route="/" zone="main" /&gt;
 *     &lt;aside&gt;&lt;LayoutSlot route="/" zone="sidebar" /&gt;&lt;/aside&gt;
 *   &lt;/div&gt;
 * &lt;/template&gt;
 * ```
 *
 * For each row in the zone:
 *   - Renders a 12-column CSS Grid container with the row's gap setting
 *   - For each enabled + visible section: renders the registered section
 *     component, scoped to its resolved colSpan
 *
 * Visibility filters (run client-side on every render so role/feature
 * changes propagate without a re-fetch):
 *   - section.enabled === false → skipped
 *   - visibility.features intersected with active feature flags must
 *     have ALL flags ON
 *   - visibility.roles must include the current user's role (or
 *     'anonymous' for unauthenticated)
 *
 * When the layout-engine feature is OFF (the default for v1), `useLayout`
 * resolves to null and this component renders nothing — pages that
 * adopt &lt;LayoutSlot&gt; need a v-if fallback to the legacy renderer
 * during the migration window.
 *
 * Section rendering: the registry component map is populated by a Nuxt
 * plugin at startup (Phase 1c). Until then, unknown types render
 * an admin-only error placeholder.
 */
import { computed } from 'vue';
import type { LayoutPayload, LayoutZoneClient, LayoutRow as LayoutRowType } from '../composables/useLayout';
import type { EditorSelection } from '../composables/useLayoutEditor';
import LayoutRow from './LayoutRow.vue';

const props = withDefaults(defineProps<{
  /** Route path this layout is for — e.g. '/', '/blog', '/hubs/foo'. */
  route: string;
  /** Zone slug — must match a zone declared in the layout's storage. */
  zone: string;
  /**
   * Optional override — when set, this layout is rendered INSTEAD of
   * fetching from /api/layouts/by-route. Used by the editor preview
   * pane to render the in-progress draft without a save round-trip.
   */
  previewOverride?: LayoutPayload | null;
  /**
   * Editor mode flag. When `true`, the row + section wrappers get
   * `--editable` modifier classes (dashed hover outline + type-label
   * badge) AND Phase 3b/A's selection chrome (tabindex, click→select,
   * keyboard activation, --selected outline). Drag-drop itself wires
   * up in the next commits of this session via @vue-dnd-kit/core
   * makeDraggable/makeDroppable on the section/row containers.
   *
   * Default `false` so public render paths (pages/index.vue,
   * [...customPath].vue) are byte-pattern unchanged. The selection
   * callback prop is optional — its absence makes the section
   * affordances inert (still focusable visually but click is a no-op),
   * so consumers without an editor in scope don't accidentally light
   * up selection behavior.
   *
   * See docs/plans/phase-3-editor.md Phase 3a.1 + 3b/A.
   */
  editable?: boolean;
  /**
   * Selection callback — called when the admin clicks (or presses
   * Enter/Space on) a section in editable mode. The editor page wires
   * this to `useLayoutEditor.select` so the inspector dispatcher
   * switches to the section-config form. Optional — when absent,
   * editable=true still paints the chrome but click is inert.
   */
  onSelect?: (selection: EditorSelection) => void;
  /**
   * The currently-selected target — drives the `--selected` modifier
   * class on the section or row wrapper. Read from the editor's
   * reactive `selectedId` ref upstream so the highlight updates without
   * a re-render contract. Optional; defaults to null (no highlight).
   */
  selectedId?: EditorSelection | null;
  /**
   * Phase 3b/B — cross-zone lookup, threaded down to each LayoutRow's
   * drop handler. Synthesised by AdminLayoutsCanvas from the editor's
   * full draft (which the public render path doesn't have access to).
   * Without it, cross-row drops fall back to noop in the dispatcher.
   */
  findRow?: (rowId: string) => LayoutRowType | null;
  /** Phase 3b/B — zone-of-row lookup for narration. */
  findZone?: (rowId: string) => string | null;
  /** Phase 3b/B — all zone slugs in the active layout. Drives the
   *  "Move to zone…" popover's option list. */
  zoneSlugs?: string[];
  /** Phase 3b/B — landing-row lookup for the "Move to zone…" path. */
  findFirstRowInZone?: (zoneSlug: string) => LayoutRowType | null;
}>(), {
  previewOverride: null,
  editable: false,
  onSelect: undefined,
  selectedId: null,
  findRow: undefined,
  findZone: undefined,
  zoneSlugs: () => [],
  findFirstRowInZone: undefined,
});

const { layout, pending } = useLayout(props.route);

const activeLayout = computed(() => props.previewOverride ?? layout.value);

const zone = computed<LayoutZoneClient | null>(
  () => activeLayout.value?.zones.find((z: LayoutZoneClient) => z.zone === props.zone) ?? null,
);
</script>

<template>
  <!--
    Renders nothing when:
      - layout-engine feature is off (useLayout returns null)
      - no layout exists for this route
      - no zone of that slug in the layout
      - zone has zero rows
    All four are valid "absence" cases — fall back to legacy rendering
    via the page's v-if structure.
  -->
  <!--
    Phase 3b/A extraction: row + section rendering moved to <LayoutRow>
    so each row instance can own its own `makeDroppable` template ref
    (dnd-kit composables run per-component setup; one row instance per
    component is the natural fit). The HTML SHAPE is preserved — same
    .cpub-layout-row + .cpub-layout-section classes, same data-* attrs
    — so existing tests + selectors keep working unchanged.
  -->
  <template v-if="zone && zone.rows.length > 0">
    <LayoutRow
      v-for="row in zone.rows"
      :key="row.id"
      :row="row"
      :route="route"
      :zone="zone.zone"
      :editable="editable"
      :is-preview="!!previewOverride"
      :on-select="onSelect"
      :selected-id="selectedId"
      :find-row="findRow"
      :find-zone="findZone"
      :zone-slugs="zoneSlugs"
      :find-first-row-in-zone="findFirstRowInZone"
    />
  </template>

  <!-- Loading shimmer while initial fetch is in flight (no layout payload yet) -->
  <div v-else-if="pending && !previewOverride" class="cpub-layout-skeleton" aria-hidden="true">
    <div class="cpub-layout-skeleton-row" />
    <div class="cpub-layout-skeleton-row" />
  </div>
</template>

<style scoped>
/*
 * LayoutSlot is now just a zone walker. All row + section chrome moved
 * to LayoutRow.vue in Phase 3b/A so per-row makeDroppable can attach
 * to its own template ref. Only the skeleton loader (used when
 * useLayout is still in flight) lives here.
 */
.cpub-layout-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}
.cpub-layout-skeleton-row {
  height: 60px;
  background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
  background-size: 200% 100%;
  animation: cpub-layout-skel 1.4s ease-in-out infinite;
}
@keyframes cpub-layout-skel {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-skeleton-row { animation: none; }
}
</style>
