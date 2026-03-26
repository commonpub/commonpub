<script setup lang="ts">
import type { FederatedContentItem } from '@commonpub/server';

definePageMeta({
  middleware: 'auth',
});

useHead({
  title: 'Federated Timeline',
});

const items = ref<FederatedContentItem[]>([]);
const total = ref(0);
const loading = ref(false);
const offset = ref(0);
const limit = 20;

async function loadMore() {
  loading.value = true;
  try {
    const data = await $fetch<{ items: FederatedContentItem[]; total: number }>(
      '/api/federation/timeline',
      { params: { limit, offset: offset.value } },
    );
    items.value.push(...data.items);
    total.value = data.total;
    offset.value += data.items.length;
  } finally {
    loading.value = false;
  }
}

const hasMore = computed(() => offset.value < total.value);

async function handleLike(id: string) {
  await $fetch('/api/federation/like', {
    method: 'POST',
    body: { federatedContentId: id },
  });
  // Optimistic update
  const item = items.value.find((i) => i.id === id);
  if (item) item.localLikeCount++;
}

async function handleBoost(id: string) {
  await $fetch('/api/federation/boost', {
    method: 'POST',
    body: { federatedContentId: id },
  });
}

onMounted(() => loadMore());
</script>

<template>
  <div class="cpub-page-federation">
    <div class="cpub-page-federation__header">
      <SectionHeader title="Federated Timeline" />
      <NuxtLink to="/federation/search" class="cpub-page-federation__search-link">
        Find Users
      </NuxtLink>
    </div>

    <div v-if="items.length === 0 && !loading" class="cpub-page-federation__empty">
      <p>No federated content yet.</p>
      <p>
        <NuxtLink to="/federation/search">Search for users</NuxtLink>
        on other instances to start seeing content here.
      </p>
    </div>

    <div class="cpub-page-federation__list">
      <FederatedContentCard
        v-for="item in items"
        :key="item.id"
        :content="item"
        @like="handleLike"
        @boost="handleBoost"
      />
    </div>

    <button
      v-if="hasMore"
      class="cpub-page-federation__load-more"
      :disabled="loading"
      @click="loadMore"
    >
      {{ loading ? 'Loading...' : 'Load More' }}
    </button>
  </div>
</template>

<style scoped>
.cpub-page-federation {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.cpub-page-federation__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.cpub-page-federation__search-link {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
  text-decoration: none;
  border: 2px solid var(--accent);
  padding: var(--space-1) var(--space-3);
}

.cpub-page-federation__empty {
  text-align: center;
  color: var(--text-2);
  padding: var(--space-8) 0;
}

.cpub-page-federation__empty a {
  color: var(--accent);
}

.cpub-page-federation__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-page-federation__load-more {
  display: block;
  width: 100%;
  margin-top: var(--space-4);
  padding: var(--space-3);
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text-1);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.cpub-page-federation__load-more:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-page-federation__load-more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
