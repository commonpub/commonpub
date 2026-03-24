<script setup lang="ts">
import type { ContentDetailAuthor } from '@commonpub/server';

defineProps<{
  author: ContentDetailAuthor & { contentCount?: number };
}>();
</script>

<template>
  <div class="cpub-author-card">
    <div class="cpub-author-card-top">
      <NuxtLink :to="`/u/${author.username}`" class="cpub-author-card-avatar">
        <img v-if="author.avatarUrl" :src="author.avatarUrl" :alt="author.displayName || author.username" />
        <span v-else class="cpub-author-card-initials">{{ (author.displayName || author.username).charAt(0).toUpperCase() }}</span>
      </NuxtLink>
      <div>
        <NuxtLink :to="`/u/${author.username}`" class="cpub-author-card-name">
          {{ author.displayName || author.username }}
        </NuxtLink>
        <p class="cpub-author-card-handle">@{{ author.username }}</p>
      </div>
    </div>
    <p v-if="author.bio" class="cpub-author-card-bio">{{ author.bio }}</p>
    <div class="cpub-author-card-stats">
      <span v-if="author.followerCount !== undefined">{{ author.followerCount }} followers</span>
      <span v-if="author.contentCount !== undefined">{{ author.contentCount }} posts</span>
    </div>
    <NuxtLink :to="`/u/${author.username}`" class="cpub-author-card-btn" aria-label="View profile">
      View Profile
    </NuxtLink>
  </div>
</template>

<style scoped>
.cpub-author-card {
  padding: var(--space-5);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.cpub-author-card-top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.cpub-author-card-avatar {
  width: 44px;
  height: 44px;
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

.cpub-author-card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-author-card-initials {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-dim);
}

.cpub-author-card-name {
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  text-decoration: none;
}

.cpub-author-card-name:hover {
  color: var(--accent);
}

.cpub-author-card-handle {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.cpub-author-card-bio {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-3);
}

.cpub-author-card-stats {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin-bottom: var(--space-3);
}

.cpub-author-card-btn {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-sm);
  color: var(--text);
  text-decoration: none;
  text-align: center;
}

.cpub-author-card-btn:hover {
  background: var(--surface2);
}
</style>
