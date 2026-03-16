<script setup lang="ts">
const props = defineProps<{
  title: string;
  body: string;
  author: string;
  createdAt: Date;
  pinned?: boolean;
}>();

const formattedDate = computed((): string => {
  return new Date(props.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
});
</script>

<template>
  <div :class="['cpub-announcement-band', { 'cpub-announcement-pinned': pinned }]">
    <div class="cpub-announcement-icon" aria-hidden="true">
      <i class="fa-solid fa-bullhorn"></i>
    </div>
    <div class="cpub-announcement-content">
      <div class="cpub-announcement-header">
        <h4 class="cpub-announcement-title">{{ title }}</h4>
        <span v-if="pinned" class="cpub-announcement-pin" aria-label="Pinned">
          <i class="fa-solid fa-thumbtack"></i>
        </span>
      </div>
      <p class="cpub-announcement-body">{{ body }}</p>
      <div class="cpub-announcement-meta">
        <span class="cpub-announcement-author">{{ author }}</span>
        <span class="cpub-announcement-sep" aria-hidden="true">&middot;</span>
        <time class="cpub-announcement-time">{{ formattedDate }}</time>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-announcement-band {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border);
  border-left: 4px solid var(--accent);
}

.cpub-announcement-pinned {
  background: var(--accent-bg);
}

.cpub-announcement-icon {
  flex-shrink: 0;
  color: var(--accent);
  font-size: var(--text-md);
  margin-top: 2px;
}

.cpub-announcement-content {
  flex: 1;
  min-width: 0;
}

.cpub-announcement-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.cpub-announcement-title {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  line-height: var(--leading-tight);
}

.cpub-announcement-pin {
  color: var(--accent);
  font-size: var(--text-xs);
}

.cpub-announcement-body {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cpub-announcement-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.cpub-announcement-author {
  font-weight: var(--font-weight-medium);
  color: var(--text-dim);
}

.cpub-announcement-sep {
  color: var(--text-faint);
}

.cpub-announcement-time {
  color: var(--text-faint);
}
</style>
