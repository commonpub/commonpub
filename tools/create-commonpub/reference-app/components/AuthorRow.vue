<script setup lang="ts">
import type { UserRef } from '@commonpub/server';

defineProps<{
  author: UserRef;
  date: string;
  readTime?: string;
}>();
</script>

<template>
  <div class="cpub-author-row">
    <NuxtLink :to="`/u/${author.username}`" class="cpub-author-avatar">
      <img v-if="author.avatarUrl" :src="author.avatarUrl" :alt="author.displayName || author.username" />
      <span v-else class="cpub-author-initials">{{ (author.displayName || author.username).charAt(0).toUpperCase() }}</span>
    </NuxtLink>
    <div class="cpub-author-info">
      <NuxtLink :to="`/u/${author.username}`" class="cpub-author-name">
        {{ author.displayName || author.username }}
      </NuxtLink>
      <div class="cpub-author-meta">
        <time>{{ new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</time>
        <span v-if="readTime" class="cpub-meta-sep" aria-hidden="true">&middot;</span>
        <span v-if="readTime">{{ readTime }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-author-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cpub-author-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--surface3);
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  text-decoration: none;
}

.cpub-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-author-initials {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-dim);
}

.cpub-author-name {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text);
  text-decoration: none;
}

.cpub-author-name:hover {
  color: var(--accent);
}

.cpub-author-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
