<script setup lang="ts">
const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);

const { data: site } = await useFetch(() => `/api/docs/${siteSlug.value}`);
const { data: nav } = await useFetch(() => `/api/docs/${siteSlug.value}/nav`);

useSeoMeta({
  title: () => site.value ? `${site.value.title} — Docs — CommonPub` : 'Docs — CommonPub',
  description: () => site.value?.description || '',
});
</script>

<template>
  <div class="docs-site" v-if="site">
    <div class="docs-layout">
      <aside class="docs-sidebar" aria-label="Documentation navigation">
        <h2 class="docs-sidebar-title">{{ site.title }}</h2>
        <nav class="docs-nav" v-if="nav?.length">
          <NuxtLink
            v-for="item in nav"
            :key="item.id"
            :to="`/docs/${siteSlug}/${item.path}`"
            class="docs-nav-link"
          >
            {{ item.title }}
          </NuxtLink>
        </nav>
        <p class="docs-nav-empty" v-else>No pages yet.</p>
      </aside>

      <main class="docs-main">
        <h1 class="docs-site-title">{{ site.title }}</h1>
        <p class="docs-site-desc" v-if="site.description">{{ site.description }}</p>
        <p class="docs-welcome">Select a page from the sidebar to get started.</p>
      </main>
    </div>
  </div>
  <div v-else class="not-found"><h1>Documentation site not found</h1></div>
</template>

<style scoped>
.docs-site { max-width: var(--content-wide-max-width); }
.docs-layout { display: grid; grid-template-columns: 220px 1fr; gap: var(--space-6); }
.docs-sidebar { border-right: 1px solid var(--border); padding-right: var(--space-4); }
.docs-sidebar-title { font-size: var(--text-sm); font-weight: var(--font-weight-bold); margin-bottom: var(--space-3); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-dim); }
.docs-nav { display: flex; flex-direction: column; gap: var(--space-1); }
.docs-nav-link { color: var(--text-dim); text-decoration: none; font-size: var(--text-sm); padding: var(--space-1) var(--space-2); }
.docs-nav-link:hover { color: var(--accent); background: var(--surface2); }
.docs-nav-link:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.docs-nav-empty { color: var(--text-faint); font-size: var(--text-sm); }
.docs-main { min-height: 400px; }
.docs-site-title { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2); }
.docs-site-desc { font-size: var(--text-sm); color: var(--text-dim); margin-bottom: var(--space-4); }
.docs-welcome { color: var(--text-faint); font-size: var(--text-sm); }
.not-found { text-align: center; padding: var(--space-10) 0; color: var(--text-dim); }
</style>
