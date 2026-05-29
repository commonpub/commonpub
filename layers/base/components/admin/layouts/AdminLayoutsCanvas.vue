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
import type { LayoutPayload } from '../../../composables/useLayout';

const props = withDefaults(defineProps<{
  layout: LayoutRecord | null;
  /** Simulated viewport from the toolbar. */
  viewport?: 'mobile' | 'tablet' | 'desktop';
}>(), {
  viewport: 'desktop',
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
</script>

<template>
  <section
    class="cpub-admin-layouts-canvas"
    :data-viewport="viewport"
    aria-label="Layout canvas"
  >
    <div
      class="cpub-admin-layouts-canvas-stage"
      :style="{ maxWidth: viewportWidthPx[viewport] }"
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
          <div class="cpub-admin-layouts-canvas-zone-body">
            <LayoutSlot
              :route="route"
              :zone="zoneSlug"
              :preview-override="payload"
              :editable="true"
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
