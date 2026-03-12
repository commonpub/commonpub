<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data: path } = await useFetch(() => `/api/learn/${slug.value}`);

useSeoMeta({ title: () => `Edit ${path.value?.title ?? 'Path'} — CommonPub` });
</script>

<template>
  <div class="edit-path-page" v-if="path">
    <h1 class="page-title">Edit: {{ path.title }}</h1>
    <NuxtLink :to="`/learn/${slug}`" class="cpub-back-link">Back to path</NuxtLink>

    <section class="edit-section">
      <h2 class="section-heading">Modules & Lessons</h2>
      <p class="edit-placeholder">Module and lesson editor coming soon.</p>
      <template v-if="path.modules?.length">
        <div class="module-item" v-for="mod in path.modules" :key="mod.id">
          <strong>{{ mod.title }}</strong>
          <span class="lesson-count">{{ mod.lessons?.length ?? 0 }} lessons</span>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.edit-path-page { max-width: 600px; }
.page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2); }
.cpub-back-link { color: var(--accent); text-decoration: none; font-size: var(--text-sm); display: inline-block; margin-bottom: var(--space-6); }
.cpub-back-link:hover { text-decoration: underline; }
.edit-section { border: 1px solid var(--border); background: var(--surface); padding: var(--space-4); }
.section-heading { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-3); }
.edit-placeholder { color: var(--text-faint); font-size: var(--text-sm); margin-bottom: var(--space-4); }
.module-item { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0; border-top: 1px solid var(--border); font-size: var(--text-sm); }
.lesson-count { font-size: var(--text-xs); color: var(--text-faint); }
</style>
