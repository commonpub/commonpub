<script setup lang="ts">
import type { FederatedContentItem } from '@commonpub/server';

const props = defineProps<{
  content: FederatedContentItem;
}>();

const emit = defineEmits<{
  like: [id: string];
  boost: [id: string];
}>();

const proxiedCover = computed(() => {
  const url = props.content.coverImageUrl;
  if (!url) return null;
  return `/api/image-proxy?url=${encodeURIComponent(url)}&w=600`;
});

const actorHandle = computed(() => {
  if (!props.content.actor) return 'Unknown';
  const u = props.content.actor.preferredUsername ?? 'unknown';
  return `@${u}@${props.content.actor.instanceDomain}`;
});

const actorName = computed(() =>
  props.content.actor?.displayName ?? props.content.actor?.preferredUsername ?? 'Unknown',
);

const typeLabel = computed(() => {
  if (props.content.cpubType) return props.content.cpubType;
  return props.content.apType === 'Note' ? 'post' : 'article';
});

const timeAgo = computed(() => {
  const date = props.content.publishedAt ?? props.content.receivedAt;
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
});

/** Strip HTML for safe text display */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
</script>

<template>
  <article class="cpub-fed-card">
    <div class="cpub-fed-card__header">
      <img
        v-if="content.actor?.avatarUrl"
        :src="content.actor.avatarUrl"
        :alt="`${actorName} avatar`"
        class="cpub-fed-card__avatar"
        loading="lazy"
      />
      <div v-else class="cpub-fed-card__avatar cpub-fed-card__avatar--placeholder">
        {{ actorName[0]?.toUpperCase() ?? '?' }}
      </div>

      <div class="cpub-fed-card__meta">
        <NuxtLink
          v-if="content.actor"
          :to="`/federation/users/${content.actor.preferredUsername}@${content.actor.instanceDomain}`"
          class="cpub-fed-card__author cpub-fed-card__author-link"
        >{{ actorName }}</NuxtLink>
        <span v-else class="cpub-fed-card__author">{{ actorName }}</span>
        <span class="cpub-fed-card__handle">{{ actorHandle }}</span>
      </div>

      <span class="cpub-fed-card__time">{{ timeAgo }}</span>
    </div>

    <div class="cpub-fed-card__badges">
      <span class="cpub-fed-card__type-badge">{{ typeLabel }}</span>
      <span class="cpub-fed-card__origin-badge">{{ content.originDomain }}</span>
    </div>

    <div v-if="content.coverImageUrl" class="cpub-fed-card__cover">
      <img :src="proxiedCover ?? content.coverImageUrl" :alt="content.title ?? 'Cover'" loading="lazy" />
    </div>

    <h3 v-if="content.title" class="cpub-fed-card__title">
      <a v-if="content.url" :href="content.url" target="_blank" rel="noopener">
        {{ content.title }}
      </a>
      <span v-else>{{ content.title }}</span>
    </h3>

    <p v-if="content.summary" class="cpub-fed-card__summary">
      {{ stripHtml(content.summary) }}
    </p>

    <div v-if="content.tags.length > 0" class="cpub-fed-card__tags">
      <span v-for="tag in content.tags.slice(0, 5)" :key="tag.name" class="cpub-fed-card__tag">
        {{ tag.name }}
      </span>
    </div>

    <div class="cpub-fed-card__actions">
      <button
        class="cpub-fed-card__action"
        :aria-label="`Like this ${typeLabel}`"
        @click="emit('like', content.id)"
      >
        {{ content.localLikeCount > 0 ? content.localLikeCount : '' }} Like
      </button>
      <button
        class="cpub-fed-card__action"
        :aria-label="`Boost this ${typeLabel}`"
        @click="emit('boost', content.id)"
      >
        Boost
      </button>
      <a
        v-if="content.url"
        :href="content.url"
        target="_blank"
        rel="noopener"
        class="cpub-fed-card__action"
      >
        View Original
      </a>
    </div>
  </article>
</template>

<style scoped>
.cpub-fed-card {
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
  background: var(--surface-1);
}

.cpub-fed-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.cpub-fed-card__avatar {
  width: 36px;
  height: 36px;
  border-radius: 0;
  object-fit: cover;
  border: var(--border-width-default) solid var(--border);
  flex-shrink: 0;
}

.cpub-fed-card__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--text-2);
  font-weight: 700;
}

.cpub-fed-card__meta {
  flex: 1;
  min-width: 0;
}

.cpub-fed-card__author {
  font-weight: 700;
  color: var(--text-1);
}
.cpub-fed-card__author-link {
  text-decoration: none;
  color: var(--text-1);
}
.cpub-fed-card__author-link:hover {
  color: var(--accent);
}

.cpub-fed-card__handle {
  font-size: var(--font-size-sm);
  color: var(--text-2);
  font-family: var(--font-mono);
  margin-left: var(--space-1);
}

.cpub-fed-card__time {
  font-size: var(--font-size-sm);
  color: var(--text-2);
  font-family: var(--font-mono);
}

.cpub-fed-card__badges {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.cpub-fed-card__type-badge,
.cpub-fed-card__origin-badge {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1em 0.4em;
  border: var(--border-width-default) solid var(--border);
}

.cpub-fed-card__type-badge {
  color: var(--accent);
  border-color: var(--accent);
}

.cpub-fed-card__origin-badge {
  color: var(--text-2);
}

.cpub-fed-card__cover {
  margin-bottom: var(--space-3);
}

.cpub-fed-card__cover img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border: var(--border-width-default) solid var(--border);
}

.cpub-fed-card__title {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
}

.cpub-fed-card__title a {
  color: var(--text-1);
  text-decoration: none;
}

.cpub-fed-card__title a:hover {
  text-decoration: underline;
}

.cpub-fed-card__summary {
  color: var(--text-2);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  margin-bottom: var(--space-3);
}

.cpub-fed-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.cpub-fed-card__tag {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--text-2);
  padding: 0.1em 0.3em;
  border: var(--border-width-default) solid var(--border);
}

.cpub-fed-card__actions {
  display: flex;
  gap: var(--space-3);
  border-top: var(--border-width-default) solid var(--border);
  padding-top: var(--space-3);
}

.cpub-fed-card__action {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-2);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}

.cpub-fed-card__action:hover {
  color: var(--accent);
}
</style>
