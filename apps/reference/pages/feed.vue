<script setup lang="ts">
useSeoMeta({
  title: 'Feed — CommonPub',
  description: 'Recent published content from the community.',
});

const { isAuthenticated } = useAuth();
const activeFilter = ref('all');
const page = ref(0);

const { data, refresh, status } = await useFetch('/api/content', {
  query: computed(() => ({
    status: 'published',
    type: activeFilter.value === 'all' ? undefined : activeFilter.value,
    sort: 'recent',
    limit: 12,
    offset: page.value * 12,
  })),
  watch: [activeFilter],
});

const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);

function loadMore(): void {
  page.value++;
  refresh();
}

watch(activeFilter, () => { page.value = 0; });

const filters = [
  { value: 'all', label: 'All', icon: 'fa-solid fa-layer-group' },
  { value: 'project', label: 'Projects', icon: 'fa-solid fa-microchip' },
  { value: 'article', label: 'Articles', icon: 'fa-solid fa-file-lines' },
  { value: 'blog', label: 'Blog', icon: 'fa-solid fa-pen-nib' },
  { value: 'explainer', label: 'Explainers', icon: 'fa-solid fa-lightbulb' },
];
</script>

<template>
  <div class="feed-page">
    <div class="feed-header">
      <h1 class="feed-title">Feed</h1>
      <NuxtLink v-if="isAuthenticated" to="/create" class="cpub-btn cpub-btn-primary cpub-btn-sm">
        <i class="fa-solid fa-plus"></i> Create
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="feed-filters">
      <button
        v-for="f in filters"
        :key="f.value"
        class="feed-filter"
        :class="{ active: activeFilter === f.value }"
        @click="activeFilter = f.value"
      >
        <i :class="f.icon"></i> {{ f.label }}
      </button>
    </div>

    <!-- Content Grid -->
    <div v-if="items.length" class="feed-grid">
      <ContentCard v-for="item in items" :key="item.id" :item="item" />
    </div>

    <div v-else-if="status === 'pending'" class="feed-loading">Loading...</div>

    <div v-else class="feed-empty">
      <div class="feed-empty-icon"><i class="fa-solid fa-rss"></i></div>
      <p class="feed-empty-title">No content yet</p>
      <p class="feed-empty-sub">Published content will appear here.</p>
    </div>

    <!-- Load More -->
    <div v-if="items.length >= 12 && items.length < total" class="feed-more">
      <button class="cpub-btn" @click="loadMore" :disabled="status === 'pending'">
        {{ status === 'pending' ? 'Loading...' : 'Load More' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.feed-page { max-width: 960px; margin: 0 auto; padding: 32px; }
.feed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.feed-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }

.feed-filters { display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap; }
.feed-filter { font-size: 12px; font-family: var(--font-mono); padding: 6px 14px; border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 6px; }
.feed-filter:hover { background: var(--surface2); color: var(--text); }
.feed-filter.active { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }
.feed-filter i { font-size: 10px; }

.feed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

.feed-loading { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; }

.feed-empty { text-align: center; padding: 48px 0; }
.feed-empty-icon { font-size: 32px; color: var(--text-faint); margin-bottom: 12px; }
.feed-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.feed-empty-sub { font-size: 12px; color: var(--text-dim); }

.feed-more { text-align: center; padding: 24px 0; }

</style>
