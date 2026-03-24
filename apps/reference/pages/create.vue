<script setup lang="ts">
useSeoMeta({ title: 'Create — CommonPub' });
definePageMeta({ middleware: 'auth' });

const { isTypeEnabled } = useContentTypes();

const allTypes = [
  {
    type: 'project',
    icon: 'fa-solid fa-microchip',
    color: 'var(--accent)',
    bg: 'var(--accent-bg)',
    border: 'var(--accent-border)',
    name: 'Project',
    desc: 'Document a hardware or software build with step-by-step instructions, parts list, and build photos.',
    badge: 'Popular',
  },
  {
    type: 'article',
    icon: 'fa-solid fa-file-lines',
    color: 'var(--teal)',
    bg: 'rgba(20,184,166,0.08)',
    border: 'rgba(20,184,166,0.25)',
    name: 'Article',
    desc: 'Write a long-form technical article with code examples, diagrams, and rich formatting.',
  },
  {
    type: 'explainer',
    icon: 'fa-solid fa-lightbulb',
    color: 'var(--yellow)',
    bg: 'var(--yellow-bg)',
    border: 'var(--yellow-border)',
    name: 'Explainer',
    desc: 'Create an interactive explorable explanation with sliders, quizzes, and section-by-section progression.',
  },
  {
    type: 'blog',
    icon: 'fa-solid fa-pen-nib',
    color: 'var(--pink)',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
    name: 'Blog Post',
    desc: 'Share thoughts, tutorials, or updates with a clean writing experience and inline media.',
  },
];

const types = computed(() => allTypes.filter(t => isTypeEnabled(t.type as any)));
</script>

<template>
  <div class="cpub-create-page">
    <div class="cpub-create-header">
      <div class="cpub-create-eyebrow"><i class="fa-solid fa-plus"></i> New Content</div>
      <h1 class="cpub-create-title">What would you like to create?</h1>
      <p class="cpub-create-subtitle">Choose a content type to get started. You can change the format later.</p>
    </div>

    <div class="cpub-create-grid">
      <NuxtLink
        v-for="t in types"
        :key="t.type"
        :to="`/${t.type}/new/edit`"
        class="cpub-create-card"
      >
        <div class="cpub-create-card-icon" :style="{ color: t.color, background: t.bg, borderColor: t.border }">
          <i :class="t.icon"></i>
          <span v-if="t.badge" class="cpub-create-badge">{{ t.badge }}</span>
        </div>
        <div class="cpub-create-card-body">
          <h3 class="cpub-create-card-name">{{ t.name }}</h3>
          <p class="cpub-create-card-desc">{{ t.desc }}</p>
        </div>
        <div class="cpub-create-card-arrow">
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.cpub-create-page {
  max-width: 800px;
  padding: var(--space-8) var(--space-6);
}

.cpub-create-header {
  margin-bottom: var(--space-8);
}

.cpub-create-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: var(--space-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-create-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: var(--space-2);
  letter-spacing: -0.02em;
}

.cpub-create-subtitle {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.6;
}

.cpub-create-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cpub-create-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  background: var(--surface);
  border: 2px solid var(--border);
  text-decoration: none;
  color: inherit;
  box-shadow: 4px 4px 0 var(--border);
  transition: box-shadow 0.15s, transform 0.15s;
}

.cpub-create-card:hover {
  box-shadow: 6px 6px 0 var(--border);
  transform: translate(-1px, -1px);
}

.cpub-create-card-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  border: 2px solid;
  position: relative;
}

.cpub-create-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: 2px solid var(--border);
}

.cpub-create-card-body {
  flex: 1;
  min-width: 0;
}

.cpub-create-card-name {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.cpub-create-card-desc {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.55;
}

.cpub-create-card-arrow {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 2px solid var(--border);
  color: var(--text-faint);
  font-size: 12px;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.cpub-create-card:hover .cpub-create-card-arrow {
  background: var(--accent);
  color: var(--color-text-inverse);
  border-color: var(--border);
}

@media (max-width: 640px) {
  .cpub-create-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .cpub-create-card-arrow {
    align-self: flex-end;
  }
}
</style>
