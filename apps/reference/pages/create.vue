<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: 'Create — CommonPub',
  description: 'Create new content on CommonPub.',
});

const contentTypes = [
  { type: 'article', label: 'Article', description: 'Write an article or tutorial' },
  { type: 'blog', label: 'Blog Post', description: 'Share your thoughts and updates' },
  { type: 'project', label: 'Project', description: 'Showcase a maker project with parts and build steps' },
  { type: 'guide', label: 'Guide', description: 'Write a step-by-step how-to guide' },
] as const;
</script>

<template>
  <div class="create-page">
    <h1 class="create-title">Create New Content</h1>
    <div class="type-grid">
      <button
        v-for="ct in contentTypes"
        :key="ct.type"
        class="type-card"
        @click="navigateTo(`/${ct.type}/new/edit`)"
        :aria-label="`Create new ${ct.label}`"
      >
        <h2 class="type-card-title">{{ ct.label }}</h2>
        <p class="type-card-desc">{{ ct.description }}</p>
      </button>
    </div>
  </div>
</template>

<style scoped>
.create-page {
  max-width: var(--content-max-width);
}

.create-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--space-5);
  background: var(--surface);
  border: 2px solid var(--border);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-sans);
  transition: border-color 0.15s;
}

.type-card:hover {
  border-color: var(--accent);
}

.type-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.type-card-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin-bottom: var(--space-2);
}

.type-card-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
}
</style>
