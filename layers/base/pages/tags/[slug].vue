<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';

const route = useRoute();
const tagSlug = computed(() => route.params.slug as string);

useSeoMeta({
  title: () => `#${tagSlug.value} — ${useSiteName()}`,
  description: () => `Content tagged with "${tagSlug.value}" on CommonPub`,
});

const page = ref(0);
const { data: results, refresh } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: computed(() => ({
    tag: tagSlug.value,
    status: 'published',
    limit: 20,
    offset: page.value * 20,
  })),
});

const items = computed(() => results.value?.items ?? []);
const total = computed(() => results.value?.total ?? 0);
const hasMore = computed(() => items.value.length < total.value);

async function loadMore(): Promise<void> {
  page.value++;
  await refresh();
}
</script>

<template>
  <div class="cpub-tag-page">
    <div class="cpub-tag-header">
      <div class="cpub-tag-badge"><i class="fa-solid fa-hashtag"></i></div>
      <div>
        <h1 class="cpub-tag-title">{{ tagSlug }}</h1>
        <p class="cpub-tag-count">{{ total }} {{ total === 1 ? 'post' : 'posts' }}</p>
      </div>
    </div>

    <div v-if="items.length" class="cpub-tag-grid">
      <ContentCard
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </div>

    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-tag"></i></div>
      <p class="cpub-empty-state-title">No content with this tag</p>
    </div>

    <div v-if="hasMore" class="cpub-tag-more">
      <button class="cpub-btn" @click="loadMore">Load more</button>
    </div>
  </div>
</template>

<style scoped>
.cpub-tag-page {
  max-width: 960px;
}

.cpub-tag-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.cpub-tag-badge {
  width: 48px;
  height: 48px;
  background: var(--accent-bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--accent);
  box-shadow: var(--shadow-md);
}

.cpub-tag-title {
  font-size: 20px;
  font-weight: 700;
}

.cpub-tag-count {
  font-size: 12px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-tag-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.cpub-tag-more {
  text-align: center;
  padding: 24px 0;
}

@media (max-width: 768px) {
  .cpub-tag-grid { grid-template-columns: 1fr; }
}
</style>
