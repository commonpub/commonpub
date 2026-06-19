<script setup lang="ts">
/**
 * Section palette — left column of the editor shell.
 *
 * Phase 3a.3 shipped READ-ONLY tiles (no drag). Phase 3b/A turns each
 * tile into a drag source via <AdminLayoutsPaletteTile>'s makeDraggable.
 * The drop side lives in <LayoutRow>'s makeDroppable; the shared
 * `useLayoutDrag` module connects them.
 *
 * The categories order matches the palette grouping in
 * docs/plans/layout-and-pages.md §7.2 — layout, content, data,
 * editorial, interactive, embed, custom.
 */
import { computed } from 'vue';
import { useSectionRegistry } from '../../../sections/registry';
import type { SectionCategory, SectionDefinition } from '@commonpub/ui';
import AdminLayoutsPaletteTile from './AdminLayoutsPaletteTile.vue';

// Forward a tile's keyboard-insert request up to the editor page.
const emit = defineEmits<{ insert: [SectionDefinition] }>();

const CATEGORY_LABELS: Record<SectionCategory, string> = {
  layout: 'Layout',
  content: 'Content',
  data: 'Data',
  editorial: 'Editorial',
  interactive: 'Interactive',
  embed: 'Embed',
  custom: 'Custom',
};

// Order for visual grouping in the palette.
const CATEGORY_ORDER: SectionCategory[] = [
  'layout', 'content', 'data', 'editorial', 'interactive', 'embed', 'custom',
];

const registry = useSectionRegistry();

const grouped = computed(() => {
  const byCat = registry.byCategory();
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      sections: byCat[category],
    }))
    .filter((g) => g.sections.length > 0);
});
</script>

<template>
  <aside class="cpub-admin-layouts-palette" aria-label="Section palette">
    <header class="cpub-admin-layouts-palette-header">
      <h2 class="cpub-admin-layouts-palette-title">Sections available</h2>
      <p class="cpub-admin-layouts-palette-hint">
        Drag a tile onto a row to add a section.
      </p>
    </header>

    <div
      v-for="group in grouped"
      :key="group.category"
      class="cpub-admin-layouts-palette-group"
    >
      <h3 class="cpub-admin-layouts-palette-group-title">{{ group.label }}</h3>
      <ul class="cpub-admin-layouts-palette-list">
        <AdminLayoutsPaletteTile
          v-for="section in group.sections"
          :key="section.type"
          :section="section"
          @insert="emit('insert', $event)"
        />
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.cpub-admin-layouts-palette {
  display: flex; flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--surface);
  border-right: var(--border-width-default) solid var(--border);
  overflow-y: auto;
  height: 100%;
}

.cpub-admin-layouts-palette-header { border-bottom: 1px solid var(--border2); padding-bottom: var(--space-3); }
.cpub-admin-layouts-palette-title {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-dim);
  margin: 0 0 var(--space-1) 0;
  font-weight: var(--font-weight-semibold);
}
.cpub-admin-layouts-palette-hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin: 0;
}

.cpub-admin-layouts-palette-group { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-admin-layouts-palette-group-title {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
  margin: 0;
  font-weight: var(--font-weight-semibold);
}

.cpub-admin-layouts-palette-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-1); }

/* Tile-body styling moved to AdminLayoutsPaletteTile.vue's scoped
   styles (Vue scoped styles are component-instance hashed). Palette
   owns only the surrounding scroll container + group titles. */
</style>
