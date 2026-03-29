<script setup lang="ts">
useSeoMeta({
  title: 'Documentation — CommonPub',
  description: 'Browse documentation sites.',
});

const { data: sites, pending, error, refresh } = useLazyFetch('/api/docs');
const { isAuthenticated, user } = useAuth();

const mySites = computed(() => {
  if (!sites.value?.items || !user.value) return [];
  return sites.value.items.filter((s: { ownerId: string }) => s.ownerId === user.value!.id);
});

const otherSites = computed(() => {
  if (!sites.value?.items) return sites.value?.items ?? [];
  if (!user.value) return sites.value.items;
  return sites.value.items.filter((s: { ownerId: string }) => s.ownerId !== user.value!.id);
});
</script>

<template>
  <div class="docs-index">
    <div v-if="pending" class="cpub-loading">Loading documentation...</div>
    <div v-else-if="error" class="cpub-fetch-error">
      <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="cpub-fetch-error-msg">Failed to load documentation sites.</div>
      <button class="cpub-btn cpub-btn-sm" @click="refresh()">Retry</button>
    </div>
    <div v-else-if="!sites?.items?.length && !isAuthenticated" class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-book"></i></div>
      <div class="cpub-empty-state-title">No documentation sites yet</div>
    </div>
    <template v-else>
    <div class="docs-header">
      <div>
        <h1 class="docs-title">Documentation</h1>
        <p class="docs-subtitle">Browse documentation sites and knowledge bases.</p>
      </div>
      <NuxtLink v-if="isAuthenticated" to="/docs/create" class="cpub-btn cpub-btn-primary">
        <i class="fa-solid fa-plus"></i> Create Docs Site
      </NuxtLink>
    </div>

    <!-- My Docs -->
    <template v-if="isAuthenticated && mySites.length">
      <div class="docs-section-head">
        <h2 class="docs-section-title"><i class="fa-solid fa-user"></i> My Docs</h2>
        <span class="docs-section-count">{{ mySites.length }}</span>
      </div>
      <div class="docs-grid">
        <NuxtLink v-for="site in mySites" :key="site.id" :to="`/docs/${site.slug}`" class="docs-card">
          <div class="docs-card-icon"><i class="fa-solid fa-book"></i></div>
          <h2 class="docs-card-name">{{ site.name }}</h2>
          <p class="docs-card-desc" v-if="site.description">{{ site.description }}</p>
          <div class="docs-card-meta">
            <span class="docs-card-meta-item">
              <i class="fa-solid fa-user"></i> {{ site.owner?.displayName || site.owner?.username || 'Unknown' }}
            </span>
            <span class="docs-card-meta-item">
              <i class="fa-solid fa-clock"></i> {{ new Date(site.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
            </span>
          </div>
        </NuxtLink>
      </div>
      <hr class="docs-divider" />
    </template>

    <!-- All Docs -->
    <template v-if="otherSites.length || (!isAuthenticated && sites?.items?.length)">
      <div class="docs-section-head" v-if="isAuthenticated && mySites.length">
        <h2 class="docs-section-title">All Documentation</h2>
      </div>
      <div class="docs-grid">
        <NuxtLink v-for="site in otherSites" :key="site.id" :to="`/docs/${site.slug}`" class="docs-card">
          <div class="docs-card-icon"><i class="fa-solid fa-book"></i></div>
          <h2 class="docs-card-name">{{ site.name }}</h2>
          <p class="docs-card-desc" v-if="site.description">{{ site.description }}</p>
          <div class="docs-card-meta">
            <span class="docs-card-meta-item">
              <i class="fa-solid fa-user"></i> {{ site.owner?.displayName || site.owner?.username || 'Unknown' }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </template>

    <div v-if="!sites?.items?.length" class="docs-empty">
      <div class="docs-empty-icon"><i class="fa-solid fa-book-open"></i></div>
      <p class="docs-empty-title">No documentation sites yet</p>
      <p class="docs-empty-sub">Create your first docs site to get started.</p>
    </div>
    </template>
  </div>
</template>

<style scoped>
.docs-index { max-width: 960px; margin: 0 auto; padding: 32px; }

.docs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
}

.docs-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
.docs-subtitle { font-size: 13px; color: var(--text-dim); }

.docs-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.docs-section-title {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.docs-section-title i { font-size: 12px; color: var(--accent); }

.docs-section-count {
  font-size: 10px;
  font-family: var(--font-mono);
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 1px 6px;
  color: var(--text-faint);
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.docs-card {
  border: 2px solid var(--border);
  background: var(--surface);
  padding: 20px;
  text-decoration: none;
  color: var(--text);
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.15s, transform 0.15s;
}

.docs-card:hover {
  box-shadow: var(--shadow-sm);
  transform: translate(1px, 1px);
}

.docs-card-icon { font-size: 18px; color: var(--accent); margin-bottom: 12px; }
.docs-card-name { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.docs-card-desc { font-size: 12px; color: var(--text-dim); line-height: 1.55; margin-bottom: 12px; }

.docs-card-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.docs-card-meta-item { display: flex; align-items: center; gap: 4px; }

.docs-divider { border: none; border-top: 2px solid var(--border); margin: 32px 0; }

.docs-empty {
  text-align: center;
  padding: 64px 0;
}

.docs-empty-icon { font-size: 32px; color: var(--text-faint); margin-bottom: 12px; }
.docs-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.docs-empty-sub { font-size: 12px; color: var(--text-dim); }
</style>
