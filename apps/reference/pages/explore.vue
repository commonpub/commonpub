<script setup lang="ts">
useSeoMeta({
  title: 'Explore — CommonPub',
  description: 'Discover projects, articles, hubs, and learning paths on CommonPub.',
});

const activeTab = ref<'content' | 'hubs' | 'learn' | 'people'>('content');
const contentType = ref('');
const sort = ref('recent');

const contentQuery = computed(() => ({
  status: 'published',
  type: contentType.value || undefined,
  sort: sort.value,
  limit: 20,
}));

const { data: content, pending: contentPending, error: contentError, refresh: refreshContent } = await useFetch('/api/content', {
  query: contentQuery,
  watch: [contentQuery],
});

const { data: hubsData } = await useFetch('/api/hubs', {
  query: { limit: 12 },
  lazy: true,
});

const { data: pathsData } = await useFetch('/api/learn', {
  query: { status: 'published', limit: 12 },
  lazy: true,
});

const { data: statsData } = await useFetch('/api/stats', {
  lazy: true,
});

const { data: peopleData } = await useFetch('/api/users', {
  query: { limit: 20 },
  lazy: true,
  default: () => ({ items: [] }),
});

const contentTypes = [
  { value: '', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'article', label: 'Articles' },
  { value: 'blog', label: 'Blogs' },
  { value: 'explainer', label: 'Explainers' },
];

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
        <span class="cpub-explore-stat-l">Projects & Articles</span>
      </div>
      <div class="cpub-explore-stat">
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
      <button :class="['cpub-explore-tab', { active: activeTab === 'hubs' }]" @click="activeTab = 'hubs'">
        <i class="fa-solid fa-layer-group"></i> Hubs
      </button>
      <button :class="['cpub-explore-tab', { active: activeTab === 'learn' }]" @click="activeTab = 'learn'">
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
    </div>

    <!-- Hubs tab -->
    <div v-if="activeTab === 'hubs'" class="cpub-explore-panel">
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
    </div>

    <!-- Learn tab -->
    <div v-if="activeTab === 'learn'" class="cpub-explore-panel">
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
          <div class="cpub-explore-hub-icon" style="border-radius: 50%">
            <span style="font-weight: 700; font-family: var(--font-mono);">{{ (person.displayName || person.username).charAt(0).toUpperCase() }}</span>
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
    </div>
  </div>
</template>

<style scoped>
.cpub-explore {
  max-width: 1000px;
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
  border: 2px solid var(--border);
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
  border-right: 2px solid var(--border);
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
  border-bottom: 2px solid var(--border);
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
  border: 2px solid var(--border2);
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
  border: 2px solid var(--border);
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
  border: 2px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
}

.cpub-explore-hub-card:hover { box-shadow: 4px 4px 0 var(--border); }

.cpub-explore-hub-icon {
  width: 40px;
  height: 40px;
  background: var(--accent-bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--accent);
  flex-shrink: 0;
}

.cpub-explore-hub-body { flex: 1; min-width: 0; }
.cpub-explore-hub-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.cpub-explore-hub-desc { font-size: 11px; color: var(--text-dim); line-height: 1.5; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-explore-hub-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; gap: 8px; align-items: center; }

/* Path cards */
.cpub-explore-path-card {
  padding: 16px;
  background: var(--surface);
  border: 2px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
}

.cpub-explore-path-card:hover { box-shadow: 4px 4px 0 var(--border); }

.cpub-explore-path-badge {
  width: 32px;
  height: 32px;
  background: var(--green-bg);
  border: 2px solid var(--border);
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

@media (max-width: 768px) {
  .cpub-explore-grid { grid-template-columns: 1fr; }
  .cpub-explore-hub-grid { grid-template-columns: 1fr; }
  .cpub-explore-filters { flex-wrap: wrap; }
}
</style>
