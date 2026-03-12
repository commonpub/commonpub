<script setup lang="ts">
useSeoMeta({
  title: 'Search — CommonPub',
  description: 'Search for projects, tutorials, and community content.',
});

const query = ref('');
const activeFilter = ref('all');
const filters = ['all', 'project', 'article', 'guide', 'blog'] as const;

const searchQuery = computed(() => ({
  q: query.value,
  type: activeFilter.value === 'all' ? undefined : activeFilter.value,
  limit: 20,
}));

const { data: results, status } = await useFetch('/api/search', {
  query: searchQuery,
  watch: [searchQuery],
  lazy: true,
});
</script>

<template>
  <div class="search-page">
    <h1 class="search-title">Search</h1>

    <div class="search-bar">
      <input
        v-model="query"
        type="search"
        class="search-input"
        placeholder="Search content..."
        aria-label="Search content"
      />
    </div>

    <div class="search-filters" role="tablist" aria-label="Content type filters">
      <button
        v-for="filter in filters"
        :key="filter"
        role="tab"
        :aria-selected="activeFilter === filter"
        :class="['filter-btn', { active: activeFilter === filter }]"
        @click="activeFilter = filter"
      >
        {{ filter }}
      </button>
    </div>

    <div class="search-results">
      <p class="search-placeholder" v-if="!query">
        Enter a search term to find content across the community.
      </p>
      <p class="search-loading" v-else-if="status === 'pending'">Searching...</p>
      <template v-else-if="results?.items?.length">
        <div class="result-card" v-for="item in results.items" :key="item.id">
          <span class="result-type">{{ item.type }}</span>
          <h2 class="result-title">
            <NuxtLink :to="`/${item.type}/${item.slug}`">{{ item.title }}</NuxtLink>
          </h2>
          <p class="result-desc" v-if="item.description">{{ item.description }}</p>
          <div class="result-meta">
            <span>by {{ item.author.displayName || item.author.username }}</span>
            <span>{{ item.viewCount }} views</span>
          </div>
        </div>
      </template>
      <p class="search-placeholder" v-else>
        No results found for "{{ query }}".
      </p>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  max-width: var(--content-max-width);
}

.search-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-4);
}

.search-bar {
  margin-bottom: var(--space-4);
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-base);
  font-family: var(--font-sans);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.search-filters {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-2);
}

.filter-btn {
  padding: var(--space-1) var(--space-3);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  text-transform: capitalize;
}

.filter-btn:hover {
  color: var(--text);
  background: var(--surface2);
}

.filter-btn.active {
  color: var(--accent);
  font-weight: var(--font-weight-medium);
}

.search-placeholder {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-10) 0;
}

.search-loading {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-6) 0;
}

.result-card {
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  margin-bottom: var(--space-3);
}

.result-type {
  font-size: var(--text-xs);
  text-transform: capitalize;
  color: var(--accent);
  font-weight: var(--font-weight-medium);
}

.result-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin: var(--space-1) 0;
}

.result-title a {
  color: var(--text);
  text-decoration: none;
}

.result-title a:hover {
  color: var(--accent);
}

.result-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
}

.result-meta {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
