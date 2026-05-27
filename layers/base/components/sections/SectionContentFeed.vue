<script setup lang="ts">
/**
 * Built-in section: content-feed — a data-driven grid of content cards
 * with pagination.
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
 * Pagination (session 159 fix — initial Phase 1c shipped without a
 * load-more button; legacy `pages/index.vue` had it via offset-based
 * $fetch). State: `loadedItems` ref accumulates page results; click
 * "Load more" → $fetch with offset = loadedItems.length, append. Hide
 * the button when the API returns fewer items than the page size
 * (signals last page).
 *
 * SSR-safe: useFetch fetches at setup() and includes the payload in the
 * hydration snapshot. Subsequent load-more clicks are client-only
 * (interactive after hydration).
 *
 * `var(--*)` only.
 */
import { computed, ref, watch } from 'vue';
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

// Page size — clamp config.limit into [1, 24]. This is BOTH the initial
// page count AND the load-more increment.
const pageSize = computed(() => Math.min(Math.max(props.config.limit, 1), 24));

// Build the API query — server expects `type` (single value or absent),
// `sort`, `limit`, `tag`, `featured`. Omit empty strings so the validator
// treats them as absent (vs the empty-string=match-empty trap).
const baseQuery = computed(() => {
  const q: Record<string, unknown> = {
    status: 'published',
    sort: props.config.sort,
  };
  if (props.config.contentType) q.type = props.config.contentType;
  if (props.config.tag) q.tag = props.config.tag;
  if (props.config.featured) q.featured = true;
  return q;
});

const initialQuery = computed(() => ({ ...baseQuery.value, limit: pageSize.value }));

// Stable key so two identical content-feed sections on the same page
// share a single request, while different configurations don't collide.
const fetchKey = computed(
  () => `section-content-feed:${JSON.stringify(initialQuery.value)}`,
);

// NO await — section is rendered inside <LayoutSlot> deep in the tree;
// awaiting top-level here would require Suspense on every parent, which
// neither the production page-render path nor the editor preview pane
// is set up for. Pending state surfaces in the template instead.
const { data: feed, pending } = useFetch<PaginatedResponse<Serialized<ContentListItem>>>(
  '/api/content',
  {
    query: initialQuery,
    key: fetchKey.value,
  },
);

// Load-more state. `loadedItems` is the union of (a) the SSR-hydrated
// first page (read from feed.value on first access) plus (b) all
// client-side load-more results appended.
const extraItems = ref<Array<Serialized<ContentListItem>>>([]);
const loadingMore = ref(false);
const allLoaded = ref(false);

// Reset accumulated pages when the query shape changes (sort flips,
// content-type changes, etc) — operator changing the section config
// in the admin editor would otherwise show stale appended items.
watch(initialQuery, () => {
  extraItems.value = [];
  allLoaded.value = false;
}, { deep: true });

const items = computed(() => [
  ...(feed.value?.items ?? []),
  ...extraItems.value,
]);
const isEmpty = computed(() => !pending.value && items.value.length === 0);
const canLoadMore = computed(
  () => !pending.value && !loadingMore.value && !allLoaded.value && items.value.length >= pageSize.value,
);

async function loadMore(): Promise<void> {
  if (loadingMore.value || allLoaded.value) return;
  loadingMore.value = true;
  try {
    const offset = items.value.length;
    const more = await $fetch<PaginatedResponse<Serialized<ContentListItem>>>(
      '/api/content',
      { query: { ...baseQuery.value, limit: pageSize.value, offset } },
    );
    const newItems = more?.items ?? [];
    if (newItems.length > 0) {
      extraItems.value.push(...newItems);
    }
    if (newItems.length < pageSize.value) {
      allLoaded.value = true;  // last page returned a partial → no more
    }
  } catch {
    // Soft-fail: leave allLoaded false so the user can retry. A toast
    // here would be noisy if /api/content briefly hiccups during load.
  } finally {
    loadingMore.value = false;
  }
}
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

    <template v-else-if="!isEmpty">
      <div
        class="cpub-section-content-feed-grid"
        :data-columns="config.columns"
      >
        <ContentCard
          v-for="item in items"
          :key="item.id"
          :item="item"
        />
      </div>

      <div v-if="canLoadMore || loadingMore" class="cpub-section-content-feed-load-more">
        <button
          type="button"
          class="cpub-section-content-feed-load-more-btn"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <template v-if="loadingMore">
            <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
            Loading…
          </template>
          <template v-else>
            Load more
          </template>
        </button>
      </div>
    </template>

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

.cpub-section-content-feed-load-more {
  display: flex;
  justify-content: center;
  padding-top: var(--space-3);
}
.cpub-section-content-feed-load-more-btn {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-2) var(--space-5);
  border: var(--border-width-default) solid var(--accent);
  color: var(--accent);
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.cpub-section-content-feed-load-more-btn:hover:not(:disabled) {
  background: var(--accent-bg);
}
.cpub-section-content-feed-load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
