<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);

const { data: site } = await useFetch(() => `/api/docs/${siteSlug.value}`);

useSeoMeta({ title: () => `Edit ${site.value?.title ?? 'Docs'} — CommonPub` });
</script>

<template>
  <div class="docs-edit" v-if="site">
    <h1 class="page-title">Edit: {{ site.title }}</h1>
    <NuxtLink :to="`/docs/${siteSlug}`" class="cpub-back-link">Back to docs</NuxtLink>

    <section class="edit-section">
      <h2 class="section-heading">Pages</h2>
      <p class="edit-placeholder">Docs page editor coming soon.</p>
    </section>

    <section class="edit-section">
      <h2 class="section-heading">Versions</h2>
      <p class="edit-placeholder">Version management coming soon.</p>
    </section>
  </div>
</template>

<style scoped>
.docs-edit { max-width: 600px; }
.page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2); }
.cpub-back-link { color: var(--accent); text-decoration: none; font-size: var(--text-sm); display: inline-block; margin-bottom: var(--space-6); }
.cpub-back-link:hover { text-decoration: underline; }
.edit-section { border: 1px solid var(--border); background: var(--surface); padding: var(--space-4); margin-bottom: var(--space-4); }
.section-heading { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-3); }
.edit-placeholder { color: var(--text-faint); font-size: var(--text-sm); }
</style>
