<script setup lang="ts">
useSeoMeta({
  title: 'Documentation — CommonPub',
  description: 'Browse documentation sites.',
});

const { data: sites } = await useFetch('/api/docs');
const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="docs-index">
    <div class="docs-header">
      <h1 class="docs-title">Documentation</h1>
      <NuxtLink v-if="isAuthenticated" to="/docs/create" class="cpub-btn cpub-btn-primary">Create Docs Site</NuxtLink>
    </div>

    <div class="docs-grid" v-if="sites?.length">
      <div class="docs-card" v-for="site in sites" :key="site.id">
        <NuxtLink :to="`/docs/${site.slug}`" class="docs-card-link">
          <h2 class="docs-card-name">{{ site.title }}</h2>
          <p class="docs-card-desc" v-if="site.description">{{ site.description }}</p>
        </NuxtLink>
      </div>
    </div>
    <p class="docs-empty" v-else>No documentation sites yet.</p>
  </div>
</template>

<style scoped>
.docs-index { max-width: var(--content-max-width); }
.docs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-6); }
.docs-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }
.docs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
.docs-card { border: 1px solid var(--border); background: var(--surface); padding: var(--space-4); }
.docs-card-link { color: var(--text); text-decoration: none; }
.docs-card-name { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-2); }
.docs-card-link:hover .docs-card-name { color: var(--accent); }
.docs-card-desc { font-size: var(--text-sm); color: var(--text-dim); line-height: var(--leading-relaxed); }
.docs-empty { color: var(--text-faint); text-align: center; padding: var(--space-10) 0; }
</style>
