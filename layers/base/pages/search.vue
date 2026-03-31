<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';

useSeoMeta({
  title: 'Search -- devEco.io',
  description: 'Search for projects, articles, people, and communities.',
});

const { hubs: hubsEnabled, video: videoEnabled } = useFeatures();
const { enabledTypeMeta } = useContentTypes();

const route = useRoute();
const query = ref((route.query.q as string) || '');
const activeType = ref('all');

// Sync query ref when navigating to /search?q=... from header
watch(() => route.query.q, (newQ) => {
  if (typeof newQ === 'string' && newQ !== query.value) {
    query.value = newQ;
  }
});
const sortBy = ref('relevance');
const advOpen = ref(false);
const viewMode = ref<'grid' | 'list'>('grid');

// Advanced filters
const diffFilters = ref<string[]>([]);
const activeTags = ref<string[]>([]);
const dateFrom = ref('');
const dateTo = ref('');
const authorFilter = ref('');
const communityFilter = ref('');

const typePills = computed(() => {
  const pills: Array<{ value: string; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '' },
    ...enabledTypeMeta.value.map(m => ({ value: m.type, label: m.plural, icon: m.icon })),
  ];
  if (videoEnabled.value) {
    pills.push({ value: 'video', label: 'Videos', icon: 'fa-solid fa-video' });
  }
  if (hubsEnabled.value) {
    pills.push({ value: 'community', label: 'Communities', icon: 'fa-solid fa-people-group' });
  }
  pills.push({ value: 'people', label: 'People', icon: 'fa-solid fa-user' });
  pills.push({ value: 'fediverse', label: 'Fediverse', icon: 'fa-solid fa-globe' });
  return pills;
});

const page = ref(1);
const pageSize = 24;

// Reset page when search params change
watch([query, activeType, sortBy], () => { page.value = 1; });

const searchQuery = computed(() => ({
  q: query.value || undefined,
  type: activeType.value === 'all' ? undefined : activeType.value,
  sort: sortBy.value,
  limit: pageSize,
  offset: (page.value - 1) * pageSize,
  difficulty: diffFilters.value.length ? diffFilters.value.join(',') : undefined,
  tags: activeTags.value.length ? activeTags.value.join(',') : undefined,
  dateFrom: dateFrom.value || undefined,
  dateTo: dateTo.value || undefined,
  author: authorFilter.value || undefined,
  community: communityFilter.value || undefined,
}));

const { data: results, status } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/search', {
  query: searchQuery,
  watch: [searchQuery],
  lazy: true,
});

const resultCount = computed(() => results.value?.total ?? results.value?.items?.length ?? 0);

// Federated search
const fedResults = ref<any[]>([]);
const fedLoading = ref(false);
watch([query, activeType], async () => {
  if (activeType.value !== 'fediverse' || !query.value) { fedResults.value = []; return; }
  fedLoading.value = true;
  try {
    const data = await $fetch<{ items: any[]; total: number }>('/api/federation/timeline', {
      params: { limit: 20 },
    });
    // Client-side filter by query since the timeline endpoint doesn't have search
    const q = query.value.toLowerCase();
    fedResults.value = data.items.filter((item: any) =>
      (item.title?.toLowerCase().includes(q)) ||
      (item.content?.toLowerCase().includes(q)) ||
      (item.summary?.toLowerCase().includes(q))
    );
  } catch { fedResults.value = []; }
  fedLoading.value = false;
}, { immediate: true });

const activeFilterCount = computed(() => {
  let n = 0;
  if (diffFilters.value.length) n += diffFilters.value.length;
  if (activeTags.value.length) n += activeTags.value.length;
  if (dateFrom.value || dateTo.value) n++;
  if (authorFilter.value) n++;
  if (communityFilter.value) n++;
  return n;
});

function toggleSidebarTag(tag: string): void {
  if (activeTags.value.includes(tag)) {
    activeTags.value = activeTags.value.filter(t => t !== tag);
  } else {
    activeTags.value.push(tag);
  }
}

function clearAll(): void {
  diffFilters.value = [];
  activeTags.value = [];
  dateFrom.value = '';
  dateTo.value = '';
  authorFilter.value = '';
  communityFilter.value = '';
}

// Suggested tags for sidebar
const suggestedTags = [
  'edge-ai', 'tflite', 'tinyml', 'onnx', 'inference', 'quantization',
  'jetson', 'rpi', 'npu', 'embedded-ml', 'microcontroller', 'vision-ai',
  'llm-edge', 'tensorrt', 'arduino',
];

// Categories for sidebar
const categories = [
  { icon: 'fa-solid fa-robot', label: 'Machine Learning' },
  { icon: 'fa-solid fa-bolt', label: 'Embedded Systems' },
  { icon: 'fa-solid fa-satellite-dish', label: 'IoT & Wireless' },
  { icon: 'fa-solid fa-eye', label: 'Computer Vision' },
  { icon: 'fa-solid fa-volume-high', label: 'Audio & Speech' },
  { icon: 'fa-solid fa-battery-three-quarters', label: 'Power Systems' },
  { icon: 'fa-solid fa-gears', label: 'Robotics' },
  { icon: 'fa-solid fa-microscope', label: 'Research & Papers' },
];

// Trending searches for sidebar
const { data: trendingSearches } = await useFetch('/api/search/trending', {
  default: () => [],
  server: false,
});

const totalPages = computed(() => {
  const total = results.value?.total ?? 0;
  return Math.max(1, Math.ceil(total / pageSize));
});

const visiblePages = computed(() => {
  const tp = totalPages.value;
  const current = page.value;
  const pages: number[] = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(tp, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

function applyFilters(): void {
  page.value = 1;
  // searchQuery recomputes automatically since all refs are reactive
}

function setCategory(label: string): void {
  query.value = label;
  activeType.value = 'all';
  page.value = 1;
}

const { data: relatedCommunities } = await useFetch('/api/hubs', {
  query: { limit: 3 },
  default: () => ({ items: [] }),
  immediate: hubsEnabled.value,
});
</script>

<template>
  <div class="cpub-search-page">
    <div class="cpub-page-shell">
      <!-- ── MAIN COLUMN ── -->
      <div class="cpub-main-col">

        <!-- SEARCH HERO -->
        <div class="cpub-search-hero" :class="{ 'panel-open': advOpen }">
          <div class="cpub-hero-label">Search</div>

          <div class="cpub-search-input-wrap">
            <i class="fa-solid fa-magnifying-glass cpub-search-icon-main"></i>
            <input
              v-model="query"
              class="cpub-search-input-main"
              type="text"
              placeholder="Search projects, articles, people, communities&hellip;"
              aria-label="Search content"
            />
            <span class="cpub-search-kbd">&lceil;K</span>
          </div>

          <div class="cpub-result-meta-row">
            <span v-if="query" class="cpub-result-count">
              <strong>{{ resultCount.toLocaleString() }}</strong> results
            </span>
          </div>

          <!-- FILTER STRIP -->
          <div class="cpub-filter-strip">
            <button
              v-for="pill in typePills"
              :key="pill.value"
              class="cpub-type-pill"
              :class="{ active: activeType === pill.value }"
              @click="activeType = pill.value"
            >
              <i v-if="pill.icon" :class="pill.icon" style="font-size: 10px"></i>
              {{ pill.label }}
            </button>

            <div class="cpub-filter-right">
              <SortSelect
                v-model="sortBy"
                :options="[
                  { value: 'relevance', label: 'Relevance' },
                  { value: 'recent', label: 'Latest' },
                  { value: 'popular', label: 'Most Popular' },
                  { value: 'likes', label: 'Most Liked' },
                ]"
              />
              <button
                class="cpub-adv-filter-btn"
                :class="{ open: advOpen }"
                @click="advOpen = !advOpen"
              >
                <i class="fa-solid fa-sliders"></i>
                Filters
                <span v-if="activeFilterCount > 0" class="cpub-active-filters-badge">{{ activeFilterCount }}</span>
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- ADVANCED FILTERS PANEL -->
        <SearchFilters
          v-if="advOpen"
          v-model:diff-filters="diffFilters"
          v-model:active-tags="activeTags"
          v-model:date-from="dateFrom"
          v-model:date-to="dateTo"
          v-model:author-filter="authorFilter"
          v-model:community-filter="communityFilter"
          @apply="applyFilters"
          @clear="clearAll"
        />

        <!-- RESULTS HEADER -->
        <div v-if="query" class="cpub-results-header">
          <h2>Results for <span>"{{ query }}"</span></h2>
          <div class="cpub-view-toggle">
            <button
              class="cpub-view-btn"
              :class="{ active: viewMode === 'grid' }"
              title="Grid view"
              @click="viewMode = 'grid'"
            >
              <i class="fa-solid fa-grid-2"></i>
            </button>
            <button
              class="cpub-view-btn"
              :class="{ active: viewMode === 'list' }"
              title="List view"
              @click="viewMode = 'list'"
            >
              <i class="fa-solid fa-list"></i>
            </button>
          </div>
        </div>

        <!-- RESULTS -->
        <div v-if="!query" class="cpub-empty-state">
          <div class="cpub-empty-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
          <p class="cpub-empty-state-title">Search the community</p>
          <p class="cpub-empty-state-desc">Enter a search term to find projects, articles, and more.</p>
        </div>

        <div v-else-if="status === 'pending'" class="cpub-empty-state">
          <p class="cpub-empty-state-title">Searching&hellip;</p>
        </div>

        <!-- FEDIVERSE RESULTS -->
        <template v-if="activeType === 'fediverse' && query">
          <div v-if="fedLoading" class="cpub-empty-state"><p class="cpub-empty-state-title">Searching fediverse&hellip;</p></div>
          <div v-else-if="fedResults.length === 0" class="cpub-empty-state">
            <p class="cpub-empty-state-title">No federated results</p>
            <p class="cpub-empty-state-desc">Try <NuxtLink to="/federation/search">searching for remote users</NuxtLink> to follow, then their content will appear here.</p>
          </div>
          <div v-else class="cpub-results-grid">
            <FederatedContentCard
              v-for="item in fedResults"
              :key="item.id"
              :content="item"
            />
          </div>
        </template>

        <template v-else-if="activeType !== 'fediverse' && results?.items?.length">
          <div
            class="cpub-results-grid"
            :class="{ 'list-view': viewMode === 'list' }"
          >
            <ContentCard v-for="item in results.items" :key="item.id" :item="item" />
          </div>

          <!-- PAGINATION -->
          <div v-if="totalPages > 1" class="cpub-pagination">
            <button
              class="cpub-page-btn cpub-page-wide"
              :disabled="page <= 1"
              aria-label="Previous page"
              @click="page = Math.max(1, page - 1)"
            >
              <i class="fa-solid fa-chevron-left" style="font-size: 10px"></i>
            </button>
            <template v-if="visiblePages[0] > 1">
              <button class="cpub-page-btn" @click="page = 1">1</button>
              <span v-if="visiblePages[0] > 2" class="cpub-page-ellipsis">&hellip;</span>
            </template>
            <button
              v-for="p in visiblePages"
              :key="p"
              class="cpub-page-btn"
              :class="{ active: page === p }"
              @click="page = p"
            >
              {{ p }}
            </button>
            <template v-if="visiblePages[visiblePages.length - 1] < totalPages">
              <span v-if="visiblePages[visiblePages.length - 1] < totalPages - 1" class="cpub-page-ellipsis">&hellip;</span>
              <button class="cpub-page-btn" @click="page = totalPages">{{ totalPages }}</button>
            </template>
            <button
              class="cpub-page-btn cpub-page-wide"
              :disabled="page >= totalPages"
              aria-label="Next page"
              @click="page = Math.min(totalPages, page + 1)"
            >
              <i class="fa-solid fa-chevron-right" style="font-size: 10px"></i>
            </button>
          </div>
        </template>

        <div v-else class="cpub-empty-state">
          <div class="cpub-empty-state-icon"><i class="fa-solid fa-inbox"></i></div>
          <p class="cpub-empty-state-title">No results found</p>
          <p class="cpub-empty-state-desc">Try adjusting your search or filters.</p>
        </div>
      </div>

      <!-- ── SIDEBAR ── -->
      <SearchSidebar
        :active-tags="activeTags"
        :suggested-tags="suggestedTags"
        :categories="categories"
        :trending-searches="trendingSearches"
        :related-hubs="hubsEnabled ? (relatedCommunities?.items ?? []) : []"
        @search="(q: string) => query = q"
        @toggle-tag="toggleSidebarTag"
        @set-category="setCategory"
      />
    </div>
  </div>
</template>

<style scoped>
/* ── PAGE SHELL ── */
.cpub-page-shell {
  max-width: 1360px;
  margin: 0 auto;
  padding: 36px 24px 64px;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 36px;
  align-items: start;
}

.cpub-main-col { min-width: 0; }
.cpub-sidebar-col { min-width: 0; }

/* ── SEARCH HERO ── */
.cpub-search-hero {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 0;
  padding: 32px 32px 0;
  box-shadow: var(--shadow-sm);
}

.cpub-search-hero.panel-open {
  border-bottom: 2px solid var(--border);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.cpub-hero-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-hero-label::after {
  content: '';
  flex: 1;
  height: 2px;
  background: var(--border);
}

.cpub-search-input-wrap {
  position: relative;
  margin-bottom: 18px;
}

.cpub-search-icon-main {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-dim);
  font-size: 16px;
  pointer-events: none;
}

.cpub-search-input-main {
  width: 100%;
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: 0;
  padding: 12px 48px 12px 46px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.cpub-search-input-main:focus {
  border-color: var(--accent);
  box-shadow: var(--accent-focus-ring);
}

.cpub-search-input-main::placeholder { color: var(--text-faint); }

.cpub-search-kbd {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  background: var(--surface3);
  border: 2px solid var(--border);
  border-radius: 0;
  padding: 2px 6px;
}

.cpub-result-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 0;
  margin-bottom: -1px;
}

.cpub-result-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.cpub-result-count strong {
  color: var(--accent);
  font-weight: 600;
}

/* ── FILTER STRIP ── */
.cpub-filter-strip {
  display: flex;
  align-items: center;
  gap: 0;
  border-top: 2px solid var(--border);
  margin-top: 14px;
  padding-top: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.cpub-filter-strip::-webkit-scrollbar { display: none; }

.cpub-type-pill {
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 10px 16px;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-type-pill:hover { color: var(--text); }

.cpub-type-pill.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--accent-bg);
}

.cpub-filter-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 8px 16px;
  flex-shrink: 0;
}

.cpub-sort-select {
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: 0;
  color: var(--text-dim);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 5px 24px 5px 10px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%231a1a1a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.cpub-sort-select:focus { border-color: var(--accent); }

.cpub-adv-filter-btn {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 5px 12px;
  border: 2px solid var(--border);
  border-radius: 0;
  background: var(--surface2);
  color: var(--text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.cpub-adv-filter-btn:hover,
.cpub-adv-filter-btn.open {
  color: var(--text);
  background: var(--surface3);
}

.cpub-adv-filter-btn .fa-chevron-down {
  font-size: 9px;
  transition: transform 0.2s;
}

.cpub-adv-filter-btn.open .fa-chevron-down { transform: rotate(180deg); }

.cpub-active-filters-badge {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--color-text-inverse);
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Advanced filter panel and sidebar styles moved to SearchFilters.vue and SearchSidebar.vue */

/* ── RESULTS HEADER ── */
.cpub-results-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  margin-top: 24px;
}

.cpub-results-header h2 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}

.cpub-results-header h2 span { color: var(--text); }

.cpub-view-toggle {
  margin-left: auto;
  display: flex;
  border: 2px solid var(--border);
  border-radius: 0;
  overflow: hidden;
}

.cpub-view-btn {
  padding: 5px 10px;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 12px;
  border-right: 2px solid var(--border);
  transition: color 0.15s, background 0.15s;
}

.cpub-view-btn:last-child { border-right: none; }
.cpub-view-btn:hover { color: var(--text-dim); background: var(--surface2); }
.cpub-view-btn.active { color: var(--accent); background: var(--accent-bg); }

/* ── RESULTS GRID ── */
.cpub-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.cpub-results-grid.list-view {
  grid-template-columns: 1fr;
}

/* ── PAGINATION (page-specific override) ── */
.cpub-page-wide { width: auto; padding: 0 12px; }


/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .cpub-page-shell {
    grid-template-columns: 1fr;
  }
  .cpub-adv-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .cpub-results-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .cpub-page-shell {
    padding: 16px;
  }
  .cpub-search-hero {
    padding: 20px 16px 0;
  }
  .cpub-adv-grid {
    grid-template-columns: 1fr;
  }
  .cpub-results-grid {
    grid-template-columns: 1fr;
  }
}
</style>
