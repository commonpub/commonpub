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
 *   - homepage  `index.vue` `.cpub-main-layout`      → 1280px, `1fr 300px`, pad 28/32/48, gap 32
 *   - custom    `[...customPath].vue`                → 1280px, `minmax(0,1fr) 320px`, pad var(--space-4)
 *   - editor    `AdminLayoutsCanvas.vue`             → 375/768/100%, NO main+sidebar grid (zones stacked in boxes)
 * → the editor preview was structurally wrong vs production (broken
 * WYSIWYG) and homepage vs custom-page disagreed (300 vs 320 sidebar).
 * This collapses them to one, using the LIVE HOMEPAGE's exact values
 * (the homepage is the primary live surface the editor previews) so
 * adoption is WYSIWYG-faithful. See `LayoutSlot.vue` header.
 *
 * ## API: slots, not props
 *
 * Named slots `#full-width` / `#main` / `#sidebar` so callers keep their
 * bespoke zone content (homepage's mobile-hoist / powered-badge; the
 * editor's per-zone labels + add-row). Each region renders only when its
 * slot has content — checked via `$slots` in the template (NOT a computed
 * over `useSlots()`, which isn't reactive and can go stale).
 *
 * `editable` does NOT change the arrangement (the editor must preview the
 * REAL frame); it only flags edit mode + is forwarded to the zone
 * scoped-slots so the editor canvas can wrap each region with its own
 * chrome without re-diverging the layout.
 *
 * ## Full-width is FULL-BLEED
 *
 * The `#full-width` slot spans the full container width (edge-to-edge) —
 * matching the live homepage, where the full-width LayoutSlot is a direct
 * child of the page root (NO max-width) and only `.cpub-main-layout`
 * (main+sidebar) is capped at 1280. So the max-width / page padding live on
 * `.cpub-page-frame-grid`, NOT the outer frame; the outer frame is a plain
 * full-width block. (Verified against `index.vue` + the live commonpub.io
 * homepage — the hero renders edge-to-edge.)
 *
 * Uniquely-named `cpub-page-frame-*` classes per feedback-view-identity-classes.
 * `var(--*)` only — the frame's literal values live in `--cpub-frame-*`
 * custom props (one place; Phase 4 frame variants override them).
 */
withDefaults(defineProps<{ editable?: boolean }>(), { editable: false });
</script>

<template>
  <div class="cpub-page-frame" :class="{ 'cpub-page-frame--editable': editable }">
    <div v-if="$slots['full-width']" class="cpub-page-frame-full">
      <slot name="full-width" :editable="editable" />
    </div>

    <div
      v-if="$slots.main || $slots.sidebar"
      class="cpub-page-frame-grid"
      :data-with-sidebar="$slots.sidebar ? 'yes' : 'no'"
    >
      <main v-if="$slots.main" class="cpub-page-frame-main">
        <slot name="main" :editable="editable" />
      </main>
      <aside v-if="$slots.sidebar" class="cpub-page-frame-sidebar">
        <slot name="sidebar" :editable="editable" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cpub-page-frame {
  /* Canonical frame tokens — ONE place. Values replicate the live homepage
     so the editor canvas (which previews the homepage layout via PageFrame)
     is faithful. Override on a wrapper for Phase 4 frame variants. */
  --cpub-frame-max: 1280px;
  --cpub-frame-sidebar: 300px;
  --cpub-frame-gap: 32px;
  --cpub-frame-pad: 28px 32px 48px;
  /* Plain full-width block — NO max-width / padding here (matches the
     homepage's plain root <div>). The cap lives on the grid below so the
     full-width slot stays edge-to-edge. */
  width: 100%;
}

/* Full-bleed: spans the whole frame width (= the hero edge-to-edge). */
.cpub-page-frame-full { width: 100%; }

/* The constrained content area (main + sidebar) — this is the equivalent of
   the homepage's `.cpub-main-layout`. */
.cpub-page-frame-grid {
  max-width: var(--cpub-frame-max);
  margin: 0 auto;
  padding: var(--cpub-frame-pad);
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

/* Sidebar collapses below main on tablet/phone (matches the homepage). */
@media (max-width: 1024px) {
  .cpub-page-frame-grid[data-with-sidebar='yes'] {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .cpub-page-frame-grid { padding: 24px 16px; }
}
</style>
