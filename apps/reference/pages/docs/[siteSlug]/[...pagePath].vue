<script setup lang="ts">
const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);
const pagePath = computed(() => {
  const p = route.params.pagePath;
  return Array.isArray(p) ? p.join('/') : p;
});

const { data: site } = await useFetch(() => `/api/docs/${siteSlug.value}`);
const { data: nav } = await useFetch(() => `/api/docs/${siteSlug.value}/nav`);
const { data: pages } = await useFetch(() => `/api/docs/${siteSlug.value}/pages`);

const currentPage = computed(() => {
  if (!pages.value) return null;
  return (pages.value as Array<{ path: string; title: string; content: string }>).find(
    (p) => p.path === pagePath.value
  ) ?? null;
});

useSeoMeta({
  title: () => currentPage.value ? `${currentPage.value.title} — ${site.value?.title ?? 'Docs'}` : 'Docs — CommonPub',
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
      </aside>

      <main class="docs-main">
        <template v-if="currentPage">
          <h1 class="docs-page-title">{{ currentPage.title }}</h1>
          <div class="docs-content" v-html="currentPage.content || 'No content yet.'" />
        </template>
        <div v-else class="docs-not-found">
          <h1>Page not found</h1>
          <p>The requested documentation page could not be found.</p>
        </div>
      </main>
    </div>
  </div>
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
.docs-main { min-height: 400px; }
.docs-page-title { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); }
.docs-content { font-size: var(--text-base); line-height: var(--leading-relaxed); }
.docs-not-found { text-align: center; padding: var(--space-10) 0; color: var(--text-dim); }
</style>
