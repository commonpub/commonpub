<script setup lang="ts">
/**
 * Built-in section: editorial — a Staff-Picks grid backed by /api/content.
 *
 * Identical query pattern to content-feed but with `editorial=true` +
 * `sort=editorial` baked in. Renders `<ContentCard>` so it matches the
 * surrounding visual identity.
 *
 * Non-await `useFetch` per the session-158 pitfall (top-level await
 * inside `<LayoutSlot>` requires Suspense, which neither prod render
 * nor editor preview wraps). Pending / empty / loaded surfaced via the
 * template.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { PaginatedResponse, Serialized, ContentListItem } from '@commonpub/server';
import type { SectionRenderProps } from '@commonpub/ui';

interface EditorialConfig extends Record<string, unknown> {
  heading: string;
  limit: number;
  columns: 1 | 2 | 3 | 4;
}

const props = defineProps<SectionRenderProps<EditorialConfig>>();

const apiQuery = computed(() => ({
  status: 'published' as const,
  editorial: true,
  sort: 'editorial' as const,
  limit: Math.min(Math.max(props.config.limit, 1), 12),
}));

const fetchKey = computed(
  () => `section-editorial:${JSON.stringify(apiQuery.value)}`,
);

const { data: editorialPicks, pending } = useFetch<PaginatedResponse<Serialized<ContentListItem>>>(
  '/api/content',
  {
    query: apiQuery,
    key: fetchKey.value,
  },
);

const items = computed(() => editorialPicks.value?.items ?? []);
const isEmpty = computed(() => !pending.value && items.value.length === 0);
</script>

<template>
  <section
    class="cpub-section-editorial"
    :aria-labelledby="config.heading ? `section-editorial-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-editorial-${meta.sectionId}`"
      class="cpub-section-editorial-heading"
    >
      <i class="fa-solid fa-pen-fancy" aria-hidden="true" />
      {{ config.heading }}
    </h2>

    <div v-if="pending" class="cpub-section-editorial-loading">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
      <span>Loading…</span>
    </div>

    <div
      v-else-if="!isEmpty"
      class="cpub-section-editorial-grid"
      :data-columns="config.columns"
    >
      <ContentCard
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </div>

    <p v-else class="cpub-section-editorial-empty">
      No staff picks yet.
    </p>
  </section>
</template>

<style scoped>
.cpub-section-editorial {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-editorial-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.cpub-section-editorial-heading i {
  font-size: 0.9em;
}
.cpub-section-editorial-grid {
  display: grid;
  gap: var(--space-3);
}
.cpub-section-editorial-grid[data-columns='1'] { grid-template-columns: 1fr; }
.cpub-section-editorial-grid[data-columns='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cpub-section-editorial-grid[data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cpub-section-editorial-grid[data-columns='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }

@media (max-width: 1024px) {
  .cpub-section-editorial-grid[data-columns='3'],
  .cpub-section-editorial-grid[data-columns='4'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .cpub-section-editorial-grid { grid-template-columns: 1fr; }
}

.cpub-section-editorial-loading,
.cpub-section-editorial-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
