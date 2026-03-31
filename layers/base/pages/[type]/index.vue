<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';

const route = useRoute();
const contentType = computed(() => route.params.type as string);

useSeoMeta({
  title: () => `${contentType.value} — ${useSiteName()}`,
  description: () => `Browse ${contentType.value} on CommonPub.`,
});

const sortBy = ref('recent');
const sortOptions = ['recent', 'popular'] as const;

const { data } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: computed(() => ({
    status: 'published',
    type: contentType.value,
    sort: sortBy.value,
    limit: 20,
  })),
});
</script>

<template>
  <div class="cpub-listing">
    <div class="cpub-listing-header">
      <h1 class="cpub-listing-title">{{ contentType }}s</h1>
      <div class="cpub-listing-controls">
        <select v-model="sortBy" class="cpub-listing-sort" aria-label="Sort by">
          <option v-for="opt in sortOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
        <NuxtLink :to="`/${contentType}/new/edit`" class="cpub-listing-create">
          + New {{ contentType }}
        </NuxtLink>
      </div>
    </div>

    <div class="cpub-listing-grid" v-if="data?.items?.length">
      <ContentCard v-for="item in data.items" :key="item.id" :item="item" />
    </div>
    <p class="cpub-listing-empty" v-else>No {{ contentType }}s published yet.</p>
  </div>
</template>

<style scoped>
.cpub-listing {
  max-width: var(--content-max-width);
}

.cpub-listing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.cpub-listing-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  text-transform: capitalize;
}

.cpub-listing-controls {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.cpub-listing-sort {
  padding: var(--space-1) var(--space-2);
  border: 2px solid var(--border2);
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: capitalize;
  color: var(--text-dim);
  cursor: pointer;
}

.cpub-listing-create {
  padding: var(--space-2) var(--space-3);
  background: var(--accent);
  color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-xs);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.cpub-listing-create:hover {
  opacity: 0.85;
}

.cpub-listing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.cpub-listing-empty {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-10) 0;
  text-transform: capitalize;
}
</style>
