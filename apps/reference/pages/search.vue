<script setup lang="ts">
useSeoMeta({
  title: 'Search — CommonPub',
  description: 'Search for projects, articles, people, and communities.',
});

const route = useRoute();
const query = ref((route.query.q as string) || '');
const activeType = ref('all');
const sortBy = ref('relevance');
const advOpen = ref(false);
const viewMode = ref<'grid' | 'list'>('grid');

// Advanced filters
const diffFilters = ref<string[]>([]);
const tagInput = ref('');
const activeTags = ref<string[]>([]);
const dateFrom = ref('');
const dateTo = ref('');
const authorFilter = ref('');
const communityFilter = ref('');

const typePills = [
  { value: 'all', label: 'All', icon: '' },
  { value: 'project', label: 'Projects', icon: 'fa-solid fa-wrench' },
  { value: 'article', label: 'Articles', icon: 'fa-solid fa-newspaper' },
  { value: 'blog', label: 'Blogs', icon: 'fa-solid fa-pen-nib' },
  { value: 'explainer', label: 'Explainers', icon: 'fa-solid fa-book-open' },
  { value: 'video', label: 'Videos', icon: 'fa-solid fa-video' },
  { value: 'community', label: 'Communities', icon: 'fa-solid fa-people-group' },
  { value: 'people', label: 'People', icon: 'fa-solid fa-user' },
];

const searchQuery = computed(() => ({
  q: query.value || undefined,
  type: activeType.value === 'all' ? undefined : activeType.value,
  sort: sortBy.value,
  limit: 24,
}));

const { data: results, status } = await useFetch('/api/search', {
  query: searchQuery,
  watch: [searchQuery],
  lazy: true,
});

const resultCount = computed(() => results.value?.total ?? results.value?.items?.length ?? 0);

const activeFilterCount = computed(() => {
  let n = 0;
  if (diffFilters.value.length) n += diffFilters.value.length;
  if (activeTags.value.length) n += activeTags.value.length;
  if (dateFrom.value || dateTo.value) n++;
  if (authorFilter.value) n++;
  if (communityFilter.value) n++;
  return n;
});

function toggleDiff(val: string): void {
  const idx = diffFilters.value.indexOf(val);
  if (idx >= 0) diffFilters.value.splice(idx, 1);
  else diffFilters.value.push(val);
}

function addTag(): void {
  const t = tagInput.value.trim();
  if (t && !activeTags.value.includes(t)) {
    activeTags.value.push(t);
  }
  tagInput.value = '';
}

function removeTag(tag: string): void {
  activeTags.value = activeTags.value.filter(t => t !== tag);
}

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
interface TrendingSearch { query: string; trend: number }
const { data: trendingSearches } = await useFetch<TrendingSearch[]>('/api/search/trending', {
  default: () => [],
  server: false,
});

interface CommunityListItem { id: string; name: string; slug: string; memberCount: number }
const { data: relatedCommunities } = await useFetch<{ items: CommunityListItem[] }>('/api/communities', {
  query: { limit: 3 },
  default: () => ({ items: [] }),
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
              <select v-model="sortBy" class="cpub-sort-select" aria-label="Sort results">
                <option value="relevance">Relevance</option>
                <option value="recent">Latest</option>
                <option value="popular">Most Popular</option>
                <option value="likes">Most Liked</option>
              </select>
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
        <div v-if="advOpen" class="cpub-adv-panel">
          <div class="cpub-adv-grid">
            <!-- Difficulty -->
            <div class="cpub-adv-section">
              <label class="cpub-adv-label">Difficulty</label>
              <div class="cpub-checkbox-group">
                <label v-for="d in ['Beginner', 'Intermediate', 'Advanced']" :key="d" class="cpub-check-item">
                  <input
                    type="checkbox"
                    :checked="diffFilters.includes(d.toLowerCase())"
                    @change="toggleDiff(d.toLowerCase())"
                  />
                  <span>{{ d }}</span>
                </label>
              </div>
            </div>

            <!-- Tags -->
            <div class="cpub-adv-section">
              <label class="cpub-adv-label">Tags</label>
              <input
                v-model="tagInput"
                class="cpub-adv-input"
                type="text"
                placeholder="Add tag&hellip;"
                @keyup.enter="addTag"
              />
              <div class="cpub-tag-chips">
                <span
                  v-for="tag in activeTags"
                  :key="tag"
                  class="cpub-tag-chip active"
                >
                  {{ tag }} <span class="cpub-rm" @click="removeTag(tag)">&times;</span>
                </span>
              </div>
            </div>

            <!-- Date Range -->
            <div class="cpub-adv-section">
              <label class="cpub-adv-label">Date Range</label>
              <input v-model="dateFrom" class="cpub-adv-input" type="text" placeholder="From: yyyy-mm-dd" />
              <input v-model="dateTo" class="cpub-adv-input" type="text" placeholder="To: yyyy-mm-dd" />
            </div>

            <!-- Author / Community -->
            <div class="cpub-adv-section">
              <label class="cpub-adv-label">Author</label>
              <input v-model="authorFilter" class="cpub-adv-input" type="text" placeholder="Username or name&hellip;" />
              <label class="cpub-adv-label" style="margin-top: 10px">Community</label>
              <input v-model="communityFilter" class="cpub-adv-input" type="text" placeholder="Community name&hellip;" />
            </div>

            <!-- Actions -->
            <div class="cpub-adv-actions">
              <button class="cpub-btn cpub-btn-primary cpub-btn-sm">
                <i class="fa-solid fa-check"></i> Apply Filters
              </button>
              <button class="cpub-btn cpub-btn-ghost cpub-btn-sm" @click="clearAll">
                Clear All
              </button>
            </div>
          </div>
        </div>

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

        <template v-else-if="results?.items?.length">
          <div
            class="cpub-results-grid"
            :class="{ 'list-view': viewMode === 'list' }"
          >
            <ContentCard v-for="item in results.items" :key="item.id" :item="item" />
          </div>

          <!-- PAGINATION -->
          <div class="cpub-pagination">
            <button class="cpub-page-btn cpub-page-wide" aria-label="Previous page">
              <i class="fa-solid fa-chevron-left" style="font-size: 10px"></i>
            </button>
            <button class="cpub-page-btn active">1</button>
            <button class="cpub-page-btn">2</button>
            <button class="cpub-page-btn">3</button>
            <span class="cpub-page-ellipsis">&hellip;</span>
            <button class="cpub-page-btn cpub-page-wide" aria-label="Next page">
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
      <aside class="cpub-sidebar-col">
        <!-- Trending Searches -->
        <div class="cpub-sb-block">
          <div class="cpub-sb-heading">Trending Searches</div>
          <ul class="cpub-pop-search-list">
            <li
              v-for="(item, idx) in trendingSearches?.slice(0, 8) ?? []"
              :key="idx"
              class="cpub-pop-search-item"
              @click="query = item.query"
            >
              <span class="cpub-pop-rank" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
              <span class="cpub-pop-query">{{ item.query }}</span>
              <span v-if="item.trend" class="cpub-pop-trend" :class="item.trend > 0 ? 'trend-up' : 'trend-down'">
                <i :class="item.trend > 0 ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-minus'" style="font-size: 9px"></i>
                <template v-if="item.trend > 0">+{{ item.trend }}%</template>
              </span>
            </li>
          </ul>
        </div>

        <!-- Suggested Tags -->
        <div class="cpub-sb-block">
          <div class="cpub-sb-heading">Suggested Tags</div>
          <div class="cpub-tag-cloud">
            <span
              v-for="tag in suggestedTags"
              :key="tag"
              class="cpub-s-tag"
              :class="{ active: activeTags.includes(tag) }"
              @click="toggleSidebarTag(tag)"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Browse by Category -->
        <div class="cpub-sb-block">
          <div class="cpub-sb-heading">Browse by Category</div>
          <p class="cpub-no-results-note">Not finding what you need? Try browsing a category directly.</p>
          <div class="cpub-cat-grid">
            <div v-for="cat in categories" :key="cat.label" class="cpub-cat-cell">
              <span class="cpub-cat-icon"><i :class="cat.icon"></i></span>
              <span class="cpub-cat-label">{{ cat.label }}</span>
            </div>
          </div>
        </div>

        <!-- Related Communities -->
        <div v-if="relatedCommunities?.items?.length" class="cpub-sb-block">
          <div class="cpub-sb-heading">Related Communities</div>
          <div class="cpub-related-hubs">
            <div v-for="hub in relatedCommunities.items" :key="hub.id" class="cpub-related-hub-item">
              <div class="cpub-related-hub-icon">
                <i class="fa-solid fa-users"></i>
              </div>
              <div class="cpub-related-hub-info">
                <NuxtLink :to="`/communities/${hub.slug}`" class="cpub-related-hub-name">{{ hub.name }}</NuxtLink>
                <div class="cpub-related-hub-members">{{ hub.memberCount ?? 0 }} members</div>
              </div>
              <button class="cpub-btn-join-sm">
                <i class="fa-solid fa-plus" style="font-size: 8px"></i> Join
              </button>
            </div>
          </div>
        </div>
      </aside>
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
  padding: 32px 32px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-search-hero.panel-open {
  border-bottom: 2px solid var(--border);
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
  box-shadow: 4px 4px 0 var(--accent-border);
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

/* ── ADVANCED FILTERS PANEL ── */
.cpub-adv-panel {
  background: var(--surface);
  border: 2px solid var(--border);
  border-top: none;
  padding: 24px 32px 28px;
  margin-bottom: 24px;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-adv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 20px;
  align-items: start;
}

.cpub-adv-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 10px;
}

.cpub-checkbox-group { display: flex; flex-direction: column; gap: 7px; }

.cpub-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.cpub-check-item input[type="checkbox"] {
  width: 13px;
  height: 13px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

.cpub-check-item span {
  font-size: 12px;
  color: var(--text-dim);
  user-select: none;
}

.cpub-check-item input:checked + span { color: var(--text); }

.cpub-adv-input {
  width: 100%;
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 7px 10px;
  font-size: 12px;
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  margin-bottom: 6px;
  transition: border-color 0.15s;
}

.cpub-adv-input:focus { border-color: var(--accent); }
.cpub-adv-input::placeholder { color: var(--text-faint); }

.cpub-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}

.cpub-tag-chip {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border: 2px solid var(--border2);
  background: var(--surface2);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: default;
}

.cpub-tag-chip.active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.cpub-rm {
  font-size: 11px;
  cursor: pointer;
  line-height: 1;
}

.cpub-adv-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 20px;
}

.cpub-btn {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  padding: 7px 16px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}

.cpub-btn:hover { background: var(--surface3); }

.cpub-btn-primary {
  background: var(--accent);
  color: var(--color-text-inverse);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-btn-primary:hover { box-shadow: 4px 4px 0 var(--border); }

.cpub-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-faint);
}

.cpub-btn-ghost:hover { color: var(--text-dim); background: transparent; }

.cpub-btn-sm {
  font-size: 11px;
  font-family: var(--font-mono);
}

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
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.cpub-results-grid.list-view {
  grid-template-columns: 1fr;
}

/* ── EMPTY STATE ── */
.cpub-empty-state {
  text-align: center;
  padding: 48px 24px;
}

.cpub-empty-state-icon {
  font-size: 32px;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.cpub-empty-state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.cpub-empty-state-desc {
  font-size: 12px;
  color: var(--text-faint);
}

/* ── PAGINATION ── */
.cpub-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  margin-bottom: 16px;
}

.cpub-page-btn {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  font-size: 12px;
  font-family: var(--font-mono);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.cpub-page-btn:hover {
  color: var(--text);
  background: var(--surface2);
}

.cpub-page-btn.active {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-page-wide { width: auto; padding: 0 12px; }

.cpub-page-ellipsis {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

/* ── SIDEBAR ── */
.cpub-sb-block {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 20px;
  margin-bottom: 18px;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-sb-heading {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-faint);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border);
}

/* Trending Searches */
.cpub-pop-search-list { list-style: none; }

.cpub-pop-search-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border2);
  cursor: pointer;
}

.cpub-pop-search-item:last-child { border-bottom: none; }

.cpub-pop-rank {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  min-width: 16px;
  text-align: right;
}

.cpub-pop-rank.top { color: var(--accent); }

.cpub-pop-query {
  flex: 1;
  font-size: 12px;
  color: var(--text-dim);
  transition: color 0.15s;
}

.cpub-pop-search-item:hover .cpub-pop-query { color: var(--text); }

.cpub-pop-trend {
  font-size: 10px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 3px;
}

.trend-up { color: var(--green); }
.trend-down { color: var(--text-faint); }

/* Suggested Tags */
.cpub-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cpub-s-tag {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 4px 10px;
  border: 2px solid var(--border);
  background: var(--surface2);
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
}

.cpub-s-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.cpub-s-tag.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

/* Categories */
.cpub-no-results-note {
  font-size: 11px;
  color: var(--text-faint);
  margin-bottom: 12px;
  line-height: 1.55;
}

.cpub-cat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.cpub-cat-cell {
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}

.cpub-cat-cell:hover {
  border-color: var(--accent);
  background: var(--surface3);
}

.cpub-cat-icon {
  font-size: 18px;
  margin-bottom: 4px;
  display: block;
}

.cpub-cat-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  line-height: 1.3;
}

/* Related Communities */
.cpub-related-hubs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-related-hub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border2);
  cursor: pointer;
}

.cpub-related-hub-item:last-child { border-bottom: none; }

.cpub-related-hub-icon {
  font-size: 20px;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.cpub-related-hub-info { flex: 1; min-width: 0; }

.cpub-related-hub-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 1px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
}

.cpub-related-hub-name:hover { color: var(--accent); }

.cpub-related-hub-members {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-btn-join-sm {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border: 2px solid var(--border);
  background: var(--green-bg);
  color: var(--green);
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 1px 1px 0 var(--border);
  transition: all 0.15s;
}

.cpub-btn-join-sm:hover {
  background: var(--green-bg);
  box-shadow: 2px 2px 0 var(--border);
}

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
