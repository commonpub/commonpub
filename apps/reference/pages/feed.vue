<script setup lang="ts">
useSeoMeta({
  title: 'Feed — CommonPub',
  description: 'Recent published content from the community.',
});

const page = ref(0);

const { data, refresh, status } = await useFetch('/api/content', {
  query: computed(() => ({
    status: 'published',
    sort: 'recent',
    limit: 20,
    offset: page.value * 20,
  })),
});

function loadMore(): void {
  page.value++;
  refresh();
}
</script>

<template>
  <div class="feed-page">
    <h1 class="feed-title">Recent Activity</h1>

    <template v-if="data?.items?.length">
      <div class="feed-item" v-for="item in data.items" :key="item.id">
        <div class="feed-item-header">
          <NuxtLink :to="`/u/${item.author.username}`" class="feed-author">
            {{ item.author.displayName || item.author.username }}
          </NuxtLink>
          <span class="feed-action">published a {{ item.type }}</span>
          <time class="feed-time">{{ new Date(item.publishedAt || item.createdAt).toLocaleDateString() }}</time>
        </div>
        <h2 class="feed-item-title">
          <NuxtLink :to="`/${item.type}/${item.slug}`">{{ item.title }}</NuxtLink>
        </h2>
        <p class="feed-item-desc" v-if="item.description">{{ item.description }}</p>
      </div>

      <button
        v-if="data.items.length >= 20"
        class="cpub-load-more"
        @click="loadMore"
        :disabled="status === 'pending'"
      >
        {{ status === 'pending' ? 'Loading...' : 'Load more' }}
      </button>
    </template>
    <p class="feed-empty" v-else>No activity yet.</p>
  </div>
</template>

<style scoped>
.feed-page {
  max-width: var(--content-max-width);
}

.feed-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.feed-item {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.feed-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}

.feed-author {
  color: var(--text);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.feed-author:hover {
  color: var(--accent);
}

.feed-action {
  color: var(--text-dim);
}

.feed-time {
  color: var(--text-faint);
  margin-left: auto;
}

.feed-item-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
}

.feed-item-title a {
  color: var(--text);
  text-decoration: none;
}

.feed-item-title a:hover {
  color: var(--accent);
}

.feed-item-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
}

.cpub-load-more {
  display: block;
  width: 100%;
  padding: var(--space-3);
  margin-top: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--accent);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  cursor: pointer;
}

.cpub-load-more:hover:not(:disabled) {
  background: var(--surface2);
}

.cpub-load-more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-load-more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.feed-empty {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-10) 0;
}
</style>
