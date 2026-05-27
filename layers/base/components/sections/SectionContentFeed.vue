<script setup lang="ts">
/**
 * Built-in section: content-feed — a data-driven grid of content cards.
 *
 * Phase 1c starter and the first DATA section. Fetches `/api/content`
 * with config-driven filter parameters; renders the existing
 * `<ContentCard>` so the visual identity matches feeds elsewhere on the
 * site.
 *
 * Each instance fetches independently (no global feed cache) — Nuxt's
 * useFetch dedupes by `key`, which we derive from the config so two
 * identically-configured feeds share a single request while two
 * differently-configured feeds (e.g. main + sidebar with different
 * `sort`) hit the endpoint separately.
 *
 * SSR-safe: useFetch fetches at setup() and includes the payload in the
 * hydration snapshot.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { PaginatedResponse, Serialized, ContentListItem } from '@commonpub/server';
import type { SectionRenderProps } from '@commonpub/ui';

interface ContentFeedConfig extends Record<string, unknown> {
  heading: string;
  contentType: string;
  sort: 'recent' | 'popular' | 'featured' | 'editorial';
  limit: number;
  columns: 1 | 2 | 3 | 4;
  tag: string;
  featured: boolean;
}

const props = defineProps<SectionRenderProps<ContentFeedConfig>>();

// Build the API query — server expects `type` (single value or absent),
// `sort`, `limit`, `tag`, `featured`. Omit empty strings so the validator
// treats them as absent (vs the empty-string=match-empty trap).
const apiQuery = computed(() => {
  const q: Record<string, unknown> = {
    status: 'published',
    sort: props.config.sort,
    limit: Math.min(Math.max(props.config.limit, 1), 24),
  };
  if (props.config.contentType) q.type = props.config.contentType;
  if (props.config.tag) q.tag = props.config.tag;
  if (props.config.featured) q.featured = true;
  return q;
});

// Stable key so two identical content-feed sections on the same page
// share a single request, while different configurations don't collide.
const fetchKey = computed(
  () => `section-content-feed:${JSON.stringify(apiQuery.value)}`,
);

// NO await — section is rendered inside <LayoutSlot> deep in the tree;
// awaiting top-level here would require Suspense on every parent, which
// neither the production page-render path nor the editor preview pane
// is set up for. The page (`/`, `/about`, etc.) already does its own
// `await useFetch` for content via the legacy renderer, so initial
// load is data-ready; this section's fetch is a fresh request per
// instance + config. Pending state surfaces in the template instead.
const { data: feed, pending } = useFetch<PaginatedResponse<Serialized<ContentListItem>>>(
  '/api/content',
  {
    query: apiQuery,
    key: fetchKey.value,
    // Empty-result handler: surface a friendly empty state in the template
    // rather than throwing. 404 wouldn't be a thing on /api/content anyway.
  },
);

const items = computed(() => feed.value?.items ?? []);
const isEmpty = computed(() => !pending.value && items.value.length === 0);
</script>

<template>
  <section
    class="cpub-section-content-feed"
    :aria-labelledby="config.heading ? `section-feed-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-feed-${meta.sectionId}`"
      class="cpub-section-content-feed-heading"
    >
      {{ config.heading }}
    </h2>

    <div v-if="pending" class="cpub-section-content-feed-loading">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
      <span>Loading…</span>
    </div>

    <div
      v-else-if="!isEmpty"
      class="cpub-section-content-feed-grid"
      :data-columns="config.columns"
    >
      <ContentCard
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </div>

    <p v-else class="cpub-section-content-feed-empty">
      No content yet.
    </p>
  </section>
</template>

<style scoped>
.cpub-section-content-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-content-feed-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border);
}
.cpub-section-content-feed-grid {
  display: grid;
  gap: var(--space-3);
}
.cpub-section-content-feed-grid[data-columns='1'] { grid-template-columns: 1fr; }
.cpub-section-content-feed-grid[data-columns='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cpub-section-content-feed-grid[data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cpub-section-content-feed-grid[data-columns='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }

/* Responsive collapse — multi-col grids stack on tablet/mobile */
@media (max-width: 1024px) {
  .cpub-section-content-feed-grid[data-columns='3'],
  .cpub-section-content-feed-grid[data-columns='4'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .cpub-section-content-feed-grid { grid-template-columns: 1fr; }
}

.cpub-section-content-feed-loading,
.cpub-section-content-feed-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
