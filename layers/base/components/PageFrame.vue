<script setup lang="ts">
/**
 * PageFrame — the ONE canonical page frame: arranges the three standard
 * zones (full-width above; main + sidebar grid below) at a single
 * max-width + single sidebar width + single responsive collapse.
 *
 * ## Why this exists
 *
 * The "frame" (how zones are arranged + sized) was hand-duplicated in
 * every page, and the copies drifted into FOUR divergent definitions:
 *   - homepage  `index.vue` `.cpub-main-layout`      → 1280px, `1fr 300px`
 *   - custom    `[...customPath].vue` `.cpub-custom-page-grid` → 1280px, `minmax(0,1fr) 320px`
 *   - editor    `AdminLayoutsCanvas.vue`             → 375/768/100%, NO main+sidebar grid (zones stacked in boxes)
 * → the editor preview was structurally wrong vs production (broken
 * WYSIWYG) and homepage vs custom-page disagreed (300 vs 320 sidebar).
 * This component collapses them to one. See `LayoutSlot.vue` header: "the
 * page is the FRAME; this component is the fillings" — PageFrame extracts
 * exactly that frame, nothing else.
 *
 * ## API: slots, not props
 *
 * Named slots `#full-width` / `#main` / `#sidebar` so callers keep their
 * bespoke zone content (the homepage's mobile-contest-hoist, the
 * powered-badge, the sidebar-desktop/mobile `display:contents` wrappers).
 * PageFrame owns ARRANGEMENT only. Each region renders only when its slot
 * has content (mirrors the `hasMain`/`hasSidebar` gating the custom-page
 * already used).
 *
 * `editable` does NOT change the arrangement (that is the whole point —
 * the editor must preview the REAL frame). It only flags edit mode + is
 * forwarded to the zone scoped-slots so the editor canvas (Stage 2) can
 * wrap each region with its own chrome without re-diverging the layout.
 *
 * Uniquely-named `cpub-page-frame-*` classes (NOT the old
 * `.cpub-main-layout` / `.cpub-custom-page-grid`) per
 * feedback-view-identity-classes — a shared structural class name would
 * recreate the cross-component scoped-hash coupling we're removing.
 *
 * `var(--*)` only.
 */
import { computed, useSlots } from 'vue';

withDefaults(defineProps<{ editable?: boolean }>(), { editable: false });

const slots = useSlots();
const hasFullWidth = computed<boolean>(() => !!slots['full-width']);
const hasMain = computed<boolean>(() => !!slots.main);
const hasSidebar = computed<boolean>(() => !!slots.sidebar);
</script>

<template>
  <div class="cpub-page-frame" :class="{ 'cpub-page-frame--editable': editable }">
    <div v-if="hasFullWidth" class="cpub-page-frame-full">
      <slot name="full-width" :editable="editable" />
    </div>

    <div
      v-if="hasMain || hasSidebar"
      class="cpub-page-frame-grid"
      :data-with-sidebar="hasSidebar ? 'yes' : 'no'"
    >
      <main v-if="hasMain" class="cpub-page-frame-main">
        <slot name="main" :editable="editable" />
      </main>
      <aside v-if="hasSidebar" class="cpub-page-frame-sidebar">
        <slot name="sidebar" :editable="editable" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cpub-page-frame {
  /* Canonical frame tokens — one place. Sidebar resolved to 320px (the
     wider of the two pre-consolidation values). Override per-instance by
     setting these custom props on a wrapper if a narrow frame is needed
     (Phase 4 frame variants). */
  --cpub-frame-max: 80rem; /* 1280px */
  --cpub-frame-sidebar: 320px;
  --cpub-frame-gap: var(--space-6);
  max-width: var(--cpub-frame-max);
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--cpub-frame-gap);
}

.cpub-page-frame-grid {
  display: grid;
  gap: var(--cpub-frame-gap);
  align-items: start;
}
.cpub-page-frame-grid[data-with-sidebar='yes'] {
  grid-template-columns: minmax(0, 1fr) var(--cpub-frame-sidebar);
}
.cpub-page-frame-grid[data-with-sidebar='no'] {
  grid-template-columns: 1fr;
}
.cpub-page-frame-main { min-width: 0; }

/* Sidebar collapses below main on tablet/phone. */
@media (max-width: 1024px) {
  .cpub-page-frame-grid[data-with-sidebar='yes'] {
    grid-template-columns: 1fr;
  }
}
</style>
