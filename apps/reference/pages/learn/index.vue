<script setup lang="ts">
useSeoMeta({
  title: 'Learn — CommonPub',
  description: 'Browse learning paths and grow your skills.',
});

const { data } = await useFetch('/api/learn');
const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="learn-page">
    <div class="learn-header">
      <h1 class="learn-title">Learning Paths</h1>
      <NuxtLink v-if="isAuthenticated" to="/learn/create" class="cpub-btn-primary">Create Path</NuxtLink>
    </div>

    <div class="path-grid" v-if="data?.items?.length">
      <div class="path-card" v-for="path in data.items" :key="path.id">
        <div class="path-card-thumb" :style="path.coverImageUrl ? `background-image: url(${path.coverImageUrl})` : ''" />
        <div class="path-card-body">
          <h2 class="path-card-title">
            <NuxtLink :to="`/learn/${path.slug}`">{{ path.title }}</NuxtLink>
          </h2>
          <p class="path-card-desc" v-if="path.description">{{ path.description }}</p>
          <div class="path-card-meta">
            <span v-if="path.difficulty" class="path-difficulty">{{ path.difficulty }}</span>
            <span v-if="path.estimatedHours">{{ path.estimatedHours }}h</span>
            <span>{{ path.enrollmentCount }} enrolled</span>
          </div>
        </div>
      </div>
    </div>
    <p class="learn-empty" v-else>No learning paths published yet.</p>
  </div>
</template>

<style scoped>
.learn-page {
  max-width: var(--content-max-width);
}

.learn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.learn-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
}

.cpub-btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: 1px solid var(--border);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.cpub-btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.path-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.path-card {
  border: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}

.path-card-thumb {
  height: 120px;
  background: var(--surface2);
  background-size: cover;
  background-position: center;
}

.path-card-body {
  padding: var(--space-3);
}

.path-card-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
}

.path-card-title a {
  color: var(--text);
  text-decoration: none;
}

.path-card-title a:hover {
  color: var(--accent);
}

.path-card-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-2);
}

.path-card-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.path-difficulty {
  text-transform: capitalize;
  color: var(--accent);
}

.learn-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-10) 0;
}
</style>
