<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';
import type { HomepageSectionConfig } from '@commonpub/server';

const props = defineProps<{
  config: HomepageSectionConfig;
  title?: string;
}>();

const { user: authUser } = useAuth();
const { enabledTypeMeta } = useContentTypes();
const toast = useToast();

const activeTab = ref(authUser.value ? 'foryou' : 'latest');
const tabs = computed(() => [
  { value: 'foryou', label: 'For You', icon: 'fa-solid fa-sparkles' },
  { value: 'latest', label: 'Latest', icon: 'fa-solid fa-clock' },
  { value: 'following', label: 'Following', icon: 'fa-solid fa-user-group' },
  ...enabledTypeMeta.value.map(ct => ({ value: ct.type, label: ct.plural, icon: ct.icon })),
]);

const limit = computed(() => props.config.limit ?? 12);

const contentQuery = computed(() => ({
  status: 'published',
  type: ['foryou', 'latest', 'following'].includes(activeTab.value)
    ? (props.config.contentType || undefined)
    : activeTab.value,
  sort: activeTab.value === 'latest' ? 'recent' : activeTab.value === 'following' ? 'recent' : (props.config.sort ?? 'popular'),
  ...(activeTab.value === 'following' && authUser.value?.id ? { followedBy: authUser.value.id } : {}),
  ...(props.config.categorySlug ? { categorySlug: props.config.categorySlug } : {}),
  limit: limit.value,
}));

const { data: feed, pending: feedPending } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: contentQuery,
  watch: [contentQuery],
});

const loadingMore = ref(false);
const allLoaded = ref(false);

watch(activeTab, () => { allLoaded.value = false; });

async function loadMore(): Promise<void> {
  loadingMore.value = true;
  try {
    const nextOffset = (feed.value?.items?.length ?? 0);
    const more = await $fetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
      query: { ...contentQuery.value, offset: nextOffset },
    });
    if (more.items?.length && feed.value?.items) {
      feed.value.items.push(...more.items);
    }
    if (!more.items?.length || more.items.length < limit.value) {
      allLoaded.value = true;
    }
  } catch {
    toast.error('Failed to load more');
  } finally {
    loadingMore.value = false;
  }
}

const isAuthenticated = computed(() => !!authUser.value);
const columns = computed(() => props.config.columns ?? 2);
</script>

<template>
  <div>
    <!-- Tabs -->
    <div class="cpub-tabs-bar">
      <div class="cpub-tabs-inner">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="cpub-tab"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div v-if="feedPending" class="cpub-loading-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Loading content...
    </div>
    <div v-else-if="feed?.items?.length" class="cpub-content-grid" :style="{ '--grid-cols': columns }">
      <ContentCard v-for="item in feed.items" :key="item.id" :item="item" />
    </div>
    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i :class="activeTab === 'following' ? 'fa-solid fa-user-group' : 'fa-solid fa-inbox'"></i></div>
      <template v-if="activeTab === 'following' && !isAuthenticated">
        <p class="cpub-empty-state-title">Sign in to see your feed</p>
        <p class="cpub-empty-state-desc">Follow creators to see their content here.</p>
        <NuxtLink to="/auth/login" class="cpub-btn cpub-btn-primary" style="margin-top: 12px;">Sign In</NuxtLink>
      </template>
      <template v-else-if="activeTab === 'following'">
        <p class="cpub-empty-state-title">No posts from people you follow</p>
        <NuxtLink to="/explore" class="cpub-btn" style="margin-top: 12px;"><i class="fa-solid fa-compass"></i> Explore</NuxtLink>
      </template>
      <template v-else>
        <p class="cpub-empty-state-title">No content yet</p>
        <p class="cpub-empty-state-desc">Be the first to create something!</p>
      </template>
    </div>

    <div v-if="!allLoaded && feed?.items?.length" class="cpub-load-more-row">
      <button class="cpub-btn-load-more" :disabled="loadingMore" @click="loadMore">
        <i :class="loadingMore ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-rotate'"></i>
        {{ loadingMore ? 'Loading...' : 'Load more' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-tabs-bar { border-bottom: var(--border-width-default) solid var(--border); margin-bottom: 0; }
.cpub-tabs-inner { display: flex; max-width: var(--content-max-width, 1280px); margin: 0 auto; padding: 0 var(--space-4); overflow-x: auto; }
.cpub-tab { padding: 10px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim); background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; white-space: nowrap; }
.cpub-tab:hover { color: var(--text); }
.cpub-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.cpub-content-grid { display: grid; grid-template-columns: repeat(var(--grid-cols, 2), 1fr); gap: 16px; }

.cpub-load-more-row { text-align: center; padding: 24px 0; }
.cpub-btn-load-more { font-family: var(--font-mono); font-size: 11px; padding: 8px 20px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.cpub-btn-load-more:hover { border-color: var(--accent); color: var(--accent); }

@media (max-width: 768px) { .cpub-content-grid { grid-template-columns: 1fr; } }
</style>
