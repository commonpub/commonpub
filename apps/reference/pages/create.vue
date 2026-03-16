<script setup lang="ts">
useSeoMeta({ title: 'Create — CommonPub' });
definePageMeta({ middleware: 'auth' });

const types = [
  { type: 'article', icon: 'fa-solid fa-file-lines', color: 'var(--teal)', name: 'Article', desc: 'Write a long-form article with rich formatting.' },
  { type: 'blog', icon: 'fa-solid fa-pen-nib', color: 'var(--pink)', name: 'Blog Post', desc: 'Share a blog post with code blocks and images.' },
  { type: 'project', icon: 'fa-solid fa-microchip', color: 'var(--accent)', name: 'Project', desc: 'Document a build with parts list and steps.' },
  { type: 'explainer', icon: 'fa-solid fa-lightbulb', color: 'var(--yellow)', name: 'Explainer', desc: 'Create an interactive explainer with quizzes.' },
];
</script>

<template>
  <div class="cpub-create-page">
    <h1 class="cpub-section-title-lg">Create New Content</h1>
    <p style="font-size: 13px; color: var(--text-dim); margin-bottom: 24px">Choose what type of content you'd like to create.</p>

    <div class="cpub-create-grid">
      <NuxtLink
        v-for="t in types"
        :key="t.type"
        :to="`/${t.type}/new/edit`"
        class="cpub-create-card cpub-card"
      >
        <div class="cpub-create-icon" :style="{ color: t.color }">
          <i :class="t.icon"></i>
        </div>
        <div class="cpub-card-body">
          <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px">{{ t.name }}</h3>
          <p style="font-size: 12px; color: var(--text-dim)">{{ t.desc }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.cpub-create-page {
  max-width: 720px;
}

.cpub-create-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.cpub-create-card {
  text-decoration: none;
}

.cpub-create-icon {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

@media (max-width: 640px) {
  .cpub-create-grid {
    grid-template-columns: 1fr;
  }
}
</style>
