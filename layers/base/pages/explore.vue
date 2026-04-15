<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';

useSeoMeta({
  title: `Explore — ${useSiteName()}`,
  description: 'Discover projects, articles, hubs, and learning paths on CommonPub.',
});

const { hubs: hubsEnabled, learning: learningEnabled } = useFeatures();
const { enabledTypeMeta } = useContentTypes();

const activeTab = ref<'content' | 'hubs' | 'learn' | 'people'>('content');
const contentType = ref('');
const sort = ref('recent');

const CONTENT_PAGE_SIZE = 20;
const TAB_PAGE_SIZE = 12;

const contentQuery = computed(() => ({
  status: 'published',
  type: contentType.value || undefined,
  sort: sort.value,
  limit: CONTENT_PAGE_SIZE,
}));

const { data: content, pending: contentPending, error: contentError, refresh: refreshContent } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: contentQuery,
  watch: [contentQuery],
});

// Reset content pagination when filters change
const contentAllLoaded = ref(false);
const contentLoadingMore = ref(false);
watch([contentType, sort], () => { contentAllLoaded.value = false; });

async function loadMoreContent(): Promise<void> {
  if (!content.value?.items) return;
  contentLoadingMore.value = true;
  try {
    const more = await $fetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
      query: { ...contentQuery.value, offset: content.value.items.length },
    });
    if (more?.items?.length) {
      content.value.items.push(...more.items);
    }
    if (!more?.items?.length || more.items.length < CONTENT_PAGE_SIZE) {
      contentAllLoaded.value = true;
    }
  } catch {
    contentAllLoaded.value = true;
  } finally {
    contentLoadingMore.value = false;
  }
}

interface HubItem { id: string; slug: string; name: string; description: string | null; hubType: string; memberCount: number }
const { data: hubsData } = await useFetch<{ items: HubItem[]; total: number }>('/api/hubs', {
  query: { limit: TAB_PAGE_SIZE },
  lazy: true,
});

const hubsAllLoaded = ref(false);
const hubsLoadingMore = ref(false);

async function loadMoreHubs(): Promise<void> {
  if (!hubsData.value?.items) return;
  hubsLoadingMore.value = true;
  try {
    const more = await $fetch<{ items: HubItem[]; total: number }>('/api/hubs', {
      query: { limit: TAB_PAGE_SIZE, offset: hubsData.value.items.length },
    });
    if (more?.items?.length) {
      hubsData.value.items.push(...more.items);
    }
    if (!more?.items?.length || more.items.length < TAB_PAGE_SIZE) {
      hubsAllLoaded.value = true;
    }
  } catch {
    hubsAllLoaded.value = true;
  } finally {
    hubsLoadingMore.value = false;
  }
}

interface PathItem { id: string; slug: string; title: string; description: string | null; moduleCount: number; enrollmentCount: number }
const { data: pathsData } = await useFetch<{ items: PathItem[]; total: number }>('/api/learn', {
  query: { status: 'published', limit: TAB_PAGE_SIZE },
  lazy: true,
});

const pathsAllLoaded = ref(false);
const pathsLoadingMore = ref(false);

async function loadMorePaths(): Promise<void> {
  if (!pathsData.value?.items) return;
  pathsLoadingMore.value = true;
  try {
    const more = await $fetch<{ items: PathItem[]; total: number }>('/api/learn', {
      query: { status: 'published', limit: TAB_PAGE_SIZE, offset: pathsData.value.items.length },
    });
    if (more?.items?.length) {
      pathsData.value.items.push(...more.items);
    }
    if (!more?.items?.length || more.items.length < TAB_PAGE_SIZE) {
      pathsAllLoaded.value = true;
    }
  } catch {
    pathsAllLoaded.value = true;
  } finally {
    pathsLoadingMore.value = false;
  }
}

const { data: statsData } = await useFetch('/api/stats', {
  lazy: true,
});

interface PersonItem { id: string; username: string; displayName: string | null; headline: string | null; avatarUrl: string | null; followerCount: number }
const { data: peopleData } = await useFetch<{ items: PersonItem[]; total: number }>('/api/users', {
  query: { limit: TAB_PAGE_SIZE },
  lazy: true,
  default: () => ({ items: [], total: 0 }),
});

const peopleAllLoaded = ref(false);
const peopleLoadingMore = ref(false);

async function loadMorePeople(): Promise<void> {
  if (!peopleData.value?.items) return;
  peopleLoadingMore.value = true;
  try {
    const more = await $fetch<{ items: PersonItem[]; total: number }>('/api/users', {
      query: { limit: TAB_PAGE_SIZE, offset: peopleData.value.items.length },
    });
    if (more?.items?.length) {
      peopleData.value.items.push(...more.items);
    }
    if (!more?.items?.length || more.items.length < TAB_PAGE_SIZE) {
      peopleAllLoaded.value = true;
    }
  } catch {
    peopleAllLoaded.value = true;
  } finally {
    peopleLoadingMore.value = false;
  }
}

const contentTypes = computed(() => [
  { value: '', label: 'All' },
  ...enabledTypeMeta.value.map(m => ({ value: m.type, label: m.plural })),
]);

const sortOptions = [
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
  { value: 'featured', label: 'Featured' },
];
</script>

<template>
  <div class="cpub-explore">
    <div class="cpub-explore-header">
      <h1 class="cpub-explore-title">Explore</h1>
      <p class="cpub-explore-desc">Discover what the community is building</p>
    </div>

    <!-- Stats summary -->
    <div v-if="statsData" class="cpub-explore-stats">
      <div class="cpub-explore-stat">
        <span class="cpub-explore-stat-n">{{ statsData?.content?.total ?? 0 }}</span>
        <span class="cpub-explore-stat-l">Projects & Posts</span>
      </div>
      <div v-if="hubsEnabled" class="cpub-explore-stat">
        <span class="cpub-explore-stat-n">{{ statsData?.hubs?.total ?? 0 }}</span>
        <span class="cpub-explore-stat-l">Hubs</span>
      </div>
      <div class="cpub-explore-stat">
        <span class="cpub-explore-stat-n">{{ statsData?.users?.total ?? 0 }}</span>
        <span class="cpub-explore-stat-l">Makers</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="cpub-explore-tabs">
      <button :class="['cpub-explore-tab', { active: activeTab === 'content' }]" @click="activeTab = 'content'">
        <i class="fa-solid fa-newspaper"></i> Content
      </button>
      <button v-if="hubsEnabled" :class="['cpub-explore-tab', { active: activeTab === 'hubs' }]" @click="activeTab = 'hubs'">
        <i class="fa-solid fa-layer-group"></i> Hubs
      </button>
      <button v-if="learningEnabled" :class="['cpub-explore-tab', { active: activeTab === 'learn' }]" @click="activeTab = 'learn'">
        <i class="fa-solid fa-graduation-cap"></i> Learn
      </button>
      <button :class="['cpub-explore-tab', { active: activeTab === 'people' }]" @click="activeTab = 'people'">
        <i class="fa-solid fa-users"></i> People
      </button>
    </div>

    <!-- Content tab -->
    <div v-if="activeTab === 'content'" class="cpub-explore-panel">
      <div class="cpub-explore-filters">
        <div class="cpub-filter-chips">
          <button
            v-for="ct in contentTypes"
            :key="ct.value"
            :class="['cpub-filter-chip', { active: contentType === ct.value }]"
            @click="contentType = ct.value"
          >
            {{ ct.label }}
          </button>
        </div>
        <select v-model="sort" class="cpub-sort-select" aria-label="Sort order">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div v-if="contentPending" class="cpub-loading">Loading content...</div>
      <div v-else-if="contentError" class="cpub-fetch-error">
        <div class="cpub-fetch-error-msg">Failed to load content.</div>
        <button class="cpub-btn cpub-btn-sm" @click="refreshContent()">Retry</button>
      </div>
      <div v-else-if="content?.items?.length" class="cpub-explore-grid">
        <ContentCard v-for="item in content.items" :key="item.id" :item="item" />
      </div>
      <div v-else class="cpub-empty-state">
        <p class="cpub-empty-state-title">No content found</p>
      </div>
      <div v-if="!contentAllLoaded && (content?.items?.length ?? 0) >= CONTENT_PAGE_SIZE" class="cpub-explore-more">
        <button class="cpub-btn" @click="loadMoreContent" :disabled="contentLoadingMore">
          {{ contentLoadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>

    <!-- Hubs tab -->
    <div v-if="hubsEnabled && activeTab === 'hubs'" class="cpub-explore-panel">
      <div v-if="hubsData?.items?.length" class="cpub-explore-hub-grid">
        <NuxtLink
          v-for="hub in hubsData.items"
          :key="hub.id"
          :to="`/hubs/${hub.slug}`"
          class="cpub-explore-hub-card"
        >
          <div class="cpub-explore-hub-icon">
            <i :class="hub.hubType === 'company' ? 'fa-solid fa-building' : hub.hubType === 'product' ? 'fa-solid fa-microchip' : 'fa-solid fa-users'"></i>
          </div>
          <div class="cpub-explore-hub-body">
            <h3 class="cpub-explore-hub-name">{{ hub.name }}</h3>
            <p class="cpub-explore-hub-desc">{{ hub.description || 'No description' }}</p>
            <div class="cpub-explore-hub-meta">
              <span>{{ hub.memberCount ?? 0 }} members</span>
              <span class="cpub-tag cpub-tag-xs">{{ hub.hubType ?? 'community' }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="cpub-empty-state">
        <p class="cpub-empty-state-title">No hubs yet</p>
      </div>
      <div v-if="!hubsAllLoaded && (hubsData?.items?.length ?? 0) >= TAB_PAGE_SIZE" class="cpub-explore-more">
        <button class="cpub-btn" @click="loadMoreHubs" :disabled="hubsLoadingMore">
          {{ hubsLoadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>

    <!-- Learn tab -->
    <div v-if="learningEnabled && activeTab === 'learn'" class="cpub-explore-panel">
      <div v-if="pathsData?.items?.length" class="cpub-explore-grid">
        <NuxtLink
          v-for="path in pathsData.items"
          :key="path.id"
          :to="`/learn/${path.slug}`"
          class="cpub-explore-path-card"
        >
          <div class="cpub-explore-path-badge">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <h3 class="cpub-explore-path-title">{{ path.title }}</h3>
          <p class="cpub-explore-path-desc">{{ path.description || 'No description' }}</p>
          <div class="cpub-explore-path-meta">
            <span>{{ path.moduleCount ?? 0 }} modules</span>
            <span>{{ path.enrollmentCount ?? 0 }} enrolled</span>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="cpub-empty-state">
        <p class="cpub-empty-state-title">No learning paths yet</p>
      </div>
      <div v-if="!pathsAllLoaded && (pathsData?.items?.length ?? 0) >= TAB_PAGE_SIZE" class="cpub-explore-more">
        <button class="cpub-btn" @click="loadMorePaths" :disabled="pathsLoadingMore">
          {{ pathsLoadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>

    <!-- People tab -->
    <div v-if="activeTab === 'people'" class="cpub-explore-panel">
      <div v-if="peopleData?.items?.length" class="cpub-explore-hub-grid">
        <NuxtLink
          v-for="person in peopleData.items"
          :key="person.id"
          :to="`/u/${person.username}`"
          class="cpub-explore-hub-card"
        >
          <div class="cpub-explore-hub-icon">
            <img v-if="person.avatarUrl" :src="person.avatarUrl" :alt="person.displayName || person.username" class="cpub-explore-person-avatar-img" />
            <span v-else style="font-weight: 700; font-family: var(--font-mono);">{{ (person.displayName || person.username).charAt(0).toUpperCase() }}</span>
          </div>
          <div class="cpub-explore-hub-body">
            <h3 class="cpub-explore-hub-name">{{ person.displayName || person.username }}</h3>
            <p class="cpub-explore-hub-desc">{{ person.headline || `@${person.username}` }}</p>
            <div class="cpub-explore-hub-meta">
              <span>{{ person.followerCount ?? 0 }} followers</span>
            </div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="cpub-empty-state">
        <p class="cpub-empty-state-title">No makers yet</p>
      </div>
      <div v-if="!peopleAllLoaded && (peopleData?.items?.length ?? 0) >= TAB_PAGE_SIZE" class="cpub-explore-more">
        <button class="cpub-btn" @click="loadMorePeople" :disabled="peopleLoadingMore">
          {{ peopleLoadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-explore {
  max-width: var(--content-max-width, 960px);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.cpub-explore-header {
  margin-bottom: 20px;
}

.cpub-explore-title {
  font-size: 22px;
  font-weight: 700;
}

.cpub-explore-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 4px;
}

/* Stats */
.cpub-explore-stats {
  display: flex;
  gap: 0;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  margin-bottom: 20px;
}

.cpub-explore-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px;
  border-right: var(--border-width-default) solid var(--border);
}

.cpub-explore-stat:last-child { border-right: none; }

.cpub-explore-stat-n {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.cpub-explore-stat-l {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Tabs */
.cpub-explore-tabs {
  display: flex;
  border-bottom: var(--border-width-default) solid var(--border);
  margin-bottom: 0;
}

.cpub-explore-tab {
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-explore-tab:hover { color: var(--text); }
.cpub-explore-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* Panel */
.cpub-explore-panel {
  padding: 20px 0;
}

/* Filters */
.cpub-explore-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.cpub-filter-chips {
  display: flex;
  gap: 4px;
}

.cpub-filter-chip {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 4px 10px;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
}

.cpub-filter-chip:hover { border-color: var(--border); color: var(--text); }
.cpub-filter-chip.active { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-sort-select {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 5px 8px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  outline: none;
}

/* Grid */
.cpub-explore-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* Hub cards */
.cpub-explore-hub-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.cpub-explore-hub-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
  min-width: 0;
  overflow: hidden;
}

.cpub-explore-hub-card:hover { box-shadow: var(--shadow-md); }

.cpub-explore-hub-icon {
  width: 40px;
  height: 40px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--accent);
  flex-shrink: 0;
  overflow: hidden;
}
.cpub-explore-person-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

.cpub-explore-hub-body { flex: 1; min-width: 0; }
.cpub-explore-hub-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.cpub-explore-hub-desc { font-size: 11px; color: var(--text-dim); line-height: 1.5; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cpub-explore-hub-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; gap: 8px; align-items: center; }

/* Path cards */
.cpub-explore-path-card {
  padding: 16px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
}

.cpub-explore-path-card:hover { box-shadow: var(--shadow-md); }

.cpub-explore-path-badge {
  width: 32px;
  height: 32px;
  background: var(--green-bg);
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--green);
  margin-bottom: 10px;
}

.cpub-explore-path-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.cpub-explore-path-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 8px; }
.cpub-explore-path-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; gap: 12px; }

/* cpub-tag → global components.css */
.cpub-tag-xs { font-size: 9px; }

.cpub-explore-more {
  text-align: center;
  padding: 24px 0;
}

@media (max-width: 768px) {
  .cpub-explore-grid { grid-template-columns: 1fr; }
  .cpub-explore-hub-grid { grid-template-columns: 1fr; }
  .cpub-explore-filters { flex-wrap: wrap; }
}
</style>
