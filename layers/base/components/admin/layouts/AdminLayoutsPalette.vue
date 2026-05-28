<script setup lang="ts">
/**
 * Section palette — left column of the editor shell.
 *
 * Phase 3a.3 ships the READ-ONLY view: every registered section, grouped
 * by category, each tile showing icon + name + description. NO drag
 * handlers, NO click-to-insert behavior — those arrive in Phase 3b
 * (palette → canvas drag via @vue-dnd-kit/core).
 *
 * The categories order matches the palette grouping in
 * docs/plans/layout-and-pages.md §7.2 — layout, content, data,
 * editorial, interactive, embed, custom.
 */
import { computed } from 'vue';
import { useSectionRegistry } from '../../../sections/registry';
import type { SectionCategory } from '@commonpub/ui';

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
        Catalog of section types your layouts can use. Drag-to-insert ships next release.
      </p>
    </header>

    <div
      v-for="group in grouped"
      :key="group.category"
      class="cpub-admin-layouts-palette-group"
    >
      <h3 class="cpub-admin-layouts-palette-group-title">{{ group.label }}</h3>
      <ul class="cpub-admin-layouts-palette-list">
        <li
          v-for="section in group.sections"
          :key="section.type"
          class="cpub-admin-layouts-palette-tile"
          :data-section-type="section.type"
          :data-section-status="section.status ?? 'stable'"
          :aria-label="`Section: ${section.name} (${section.type})`"
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

.cpub-admin-layouts-palette-tile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface2);
  border: 1px solid var(--border2);
  /* Cursor is `default` — NOT `grab`. Drag-to-insert ships in Phase 3b.
     Per Smashing 2021 + UX research synthesis (session 160 audit): a
     grab cursor on a tile whose pointerdown is a no-op is the single
     most common "this UI lies" pattern. The tile is a read-only label
     for now; the cursor must reflect that. The "coming soon" hint
     lives in the palette header text instead. */
  user-select: none;
}
.cpub-admin-layouts-palette-tile:hover {
  border-color: var(--border);
  background: var(--surface);
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

.cpub-admin-layouts-palette-tile-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
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
