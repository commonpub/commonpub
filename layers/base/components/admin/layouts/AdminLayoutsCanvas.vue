<script setup lang="ts">
/**
 * Canvas — center column of the editor shell. Hosts the in-progress
 * layout via <LayoutSlot :editable previewOverride>. The toolbar's
 * viewport toggle sets `viewport`, which translates to a max-width
 * cap on the inner canvas wrapper so admins can preview how the
 * layout reflows at different breakpoints WITHOUT actually resizing
 * the browser.
 *
 * Each zone the layout exposes gets a sub-pane. v1 ships the typical
 * three-zone arrangement (full-width + main + sidebar); other shapes
 * fall back to a single zone container.
 */
import { computed } from 'vue';
import type { LayoutRecord } from '@commonpub/server';
import type { LayoutPayload, LayoutRow as LayoutRowType } from '../../../composables/useLayout';
import type { EditorSelection } from '../../../composables/useLayoutEditor';

const props = withDefaults(defineProps<{
  layout: LayoutRecord | null;
  /** Simulated viewport from the toolbar. */
  viewport?: 'mobile' | 'tablet' | 'desktop';
  /**
   * Phase 3b/A — selection callback passed down to <LayoutSlot>.
   * The editor page wires this to `useLayoutEditor.select` so the
   * inspector dispatcher switches when the admin clicks a section.
   * Optional — without it, clicks are silent (canvas still renders).
   */
  onSelect?: (selection: EditorSelection) => void;
  /** Currently-selected target — drives `--selected` chrome on sections/rows. */
  selectedId?: EditorSelection | null;
}>(), {
  viewport: 'desktop',
  onSelect: undefined,
  selectedId: null,
});

// Session 162 P2.4 (R2 audit): LayoutPayload is now
// `Pick<LayoutRecord, 'state' | 'pageMeta' | 'zones'>`, so a LayoutRecord
// is structurally assignable as-is. The 25-line hand-built map this
// replaced silently dropped any newly-added section field — a future
// 'pinned' / 'theme' / etc would appear on the public render path but
// vanish from the editor preview. Direct assignment makes the preview
// shape track the live shape automatically.
const payload = computed<LayoutPayload | null>(() => props.layout);

const route = computed<string>(() => {
  if (!props.layout) return '/';
  const s = props.layout.scope;
  if (s.type === 'route' || s.type === 'custom-page') return s.path;
  return `/${s.key}`;
});

const zoneSlugs = computed<string[]>(() => {
  if (!props.layout) return [];
  return props.layout.zones.map((z) => z.zone);
});

const viewportWidthPx: Record<'mobile' | 'tablet' | 'desktop', string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

/**
 * Phase 3b/B — cross-row lookups. The dispatcher needs to find the
 * source row of a section-instance drag, which can be in any zone.
 * The Canvas has access to the WHOLE layout (vs LayoutRow which only
 * has its own row), so it synthesises these once + passes them down.
 *
 * Closures over `props.layout` — re-evaluated on every layout mutation
 * via Vue's reactivity. The closures themselves are stable references
 * (LayoutRow re-renders on prop change), but the data they read is
 * always the live, post-mutation tree.
 */
function findRow(rowId: string): LayoutRowType | null {
  const l = props.layout;
  if (!l) return null;
  for (const zone of l.zones) {
    for (const row of zone.rows) {
      if (row.id === rowId) return row as LayoutRowType;
    }
  }
  return null;
}

function findZone(rowId: string): string | null {
  const l = props.layout;
  if (!l) return null;
  for (const zone of l.zones) {
    for (const row of zone.rows) {
      if (row.id === rowId) return zone.zone;
    }
  }
  return null;
}
</script>

<template>
  <!--
    Phase 3b/A: @click.self on the canvas stage clears editor selection
    (audit R3-3). The DnDProvider above us is exactly canvas-sized, so
    its @click.self rarely fires; the stage's padded chrome (visible
    blank area between zones) is the natural click-clear surface.
    Per docs/plans/layout-and-pages.md §7.9 dispatcher pattern:
    nothing selected → page-meta form. Clicking the stage chrome IS
    "deselect" in a visual editor.
  -->
  <section
    class="cpub-admin-layouts-canvas"
    :data-viewport="viewport"
    aria-label="Layout canvas"
    @click.self="props.onSelect?.(null)"
  >
    <div
      class="cpub-admin-layouts-canvas-stage"
      :style="{ maxWidth: viewportWidthPx[viewport] }"
      @click.self="props.onSelect?.(null)"
    >
      <div v-if="!layout" class="cpub-admin-layouts-canvas-empty">
        <i class="fa-regular fa-folder-open"></i>
        <p>Loading layout…</p>
      </div>
      <template v-else>
        <div
          v-for="zoneSlug in zoneSlugs"
          :key="zoneSlug"
          class="cpub-admin-layouts-canvas-zone"
          :data-zone="zoneSlug"
        >
          <header class="cpub-admin-layouts-canvas-zone-label">
            <span class="cpub-admin-layouts-canvas-zone-label-text">{{ zoneSlug }}</span>
          </header>
          <div
            class="cpub-admin-layouts-canvas-zone-body"
            @click.self="props.onSelect?.(null)"
          >
            <LayoutSlot
              :route="route"
              :zone="zoneSlug"
              :preview-override="payload"
              :editable="true"
              :on-select="props.onSelect"
              :selected-id="props.selectedId"
              :find-row="findRow"
              :find-zone="findZone"
            />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.cpub-admin-layouts-canvas {
  display: flex;
  justify-content: center;
  padding: var(--space-6);
  background: var(--surface2);
  overflow-y: auto;
  height: 100%;
  min-width: 0;
}

.cpub-admin-layouts-canvas-stage {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  /* max-width is set dynamically by the viewport toggle (3a.5 toolbar). */
  transition: max-width 200ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-admin-layouts-canvas-stage { transition: none; }
}

.cpub-admin-layouts-canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--text-faint);
}

.cpub-admin-layouts-canvas-zone {
  background: var(--surface);
  border: 1px solid var(--border2);
}
.cpub-admin-layouts-canvas-zone-label {
  padding: var(--space-1) var(--space-3);
  background: var(--surface2);
  border-bottom: 1px solid var(--border2);
}
.cpub-admin-layouts-canvas-zone-label-text {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-faint);
}
.cpub-admin-layouts-canvas-zone-body { padding: var(--space-4); }
</style>
