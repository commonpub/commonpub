<script setup lang="ts">
const props = defineProps<{
  type: 'discussion' | 'question' | 'showcase' | 'announcement';
  title: string;
  author: string;
  authorAvatar?: string;
  authorHandle?: string;
  body: string;
  createdAt: Date;
  replyCount: number;
  voteCount: number;
  pinned?: boolean;
  locked?: boolean;
  interactive?: boolean;
  voted?: boolean;
}>();

const emit = defineEmits<{ vote: [] }>();

const typeBadgeClass = computed((): string => {
  const map: Record<string, string> = {
    discussion: 'cpub-feed-badge-accent',
    question: 'cpub-feed-badge-yellow',
    showcase: 'cpub-feed-badge-purple',
    announcement: 'cpub-feed-badge-red',
  };
  return map[props.type] || 'cpub-feed-badge-accent';
});

const formattedDate = computed((): string => {
  return new Date(props.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
});
</script>

<template>
  <article
    :class="['cpub-feed-item', { 'cpub-feed-item-pinned': pinned }]"
    :data-feed-type="type"
  >
    <div v-if="pinned" class="cpub-feed-pin" aria-label="Pinned post">
      <i class="fa-solid fa-thumbtack"></i>
      <span>Pinned</span>
    </div>

    <div class="cpub-feed-item-body">
      <div class="cpub-feed-item-header">
        <span :class="['cpub-feed-badge', typeBadgeClass]">{{ type }}</span>
        <span v-if="locked" class="cpub-feed-lock" aria-label="Locked">
          <i class="fa-solid fa-lock"></i>
        </span>
      </div>

      <h3 class="cpub-feed-item-title">{{ title }}</h3>

      <p class="cpub-feed-item-preview">{{ body }}</p>

      <div class="cpub-feed-item-meta">
        <div class="cpub-feed-item-author">
          <div v-if="authorAvatar" class="cpub-feed-avatar">
            <img :src="authorAvatar" :alt="author" />
          </div>
          <div v-else class="cpub-feed-avatar cpub-feed-avatar-placeholder">
            {{ author.charAt(0).toUpperCase() }}
          </div>
          <span class="cpub-feed-author-name">{{ author }}</span>
          <span v-if="authorHandle" class="cpub-feed-handle">{{ authorHandle }}</span>
          <span class="cpub-feed-sep" aria-hidden="true">&middot;</span>
          <time class="cpub-feed-time">{{ formattedDate }}</time>
        </div>

        <div class="cpub-feed-item-stats">
          <button v-if="interactive" class="cpub-feed-stat cpub-feed-stat-btn" :class="{ 'cpub-feed-stat-voted': voted }" aria-label="Vote" @click.prevent.stop="emit('vote')">
            <i class="fa-solid fa-arrow-up"></i> {{ voteCount }}
          </button>
          <span v-else class="cpub-feed-stat" aria-label="Votes">
            <i class="fa-solid fa-arrow-up"></i> {{ voteCount }}
          </span>
          <span class="cpub-feed-stat" aria-label="Replies">
            <i class="fa-solid fa-comment"></i> {{ replyCount }}
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.cpub-feed-item {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  position: relative;
}

.cpub-feed-item:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-md);
}

.cpub-feed-item-pinned {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.cpub-feed-pin {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--accent);
  border-bottom: var(--border-width-default) solid var(--accent-border);
}

.cpub-feed-item-body {
  padding: var(--space-4);
}

.cpub-feed-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.cpub-feed-badge {
  display: inline-block;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: var(--border-width-default) solid;
}

.cpub-feed-badge-accent {
  color: var(--accent);
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.cpub-feed-badge-yellow {
  color: var(--yellow);
  background: var(--yellow-bg);
  border-color: var(--yellow-border);
}

.cpub-feed-badge-purple {
  color: var(--purple);
  background: var(--purple-bg);
  border-color: var(--purple-border);
}

.cpub-feed-badge-red {
  color: var(--red);
  background: var(--red-bg);
  border-color: var(--red-border);
}

.cpub-feed-lock {
  color: var(--text-faint);
  font-size: var(--text-xs);
}

.cpub-feed-item-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin-bottom: var(--space-2);
  line-height: var(--leading-tight);
}

.cpub-feed-item-preview {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cpub-feed-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cpub-feed-item-author {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.cpub-feed-avatar {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
  border: var(--border-width-default) solid var(--border2);
}

.cpub-feed-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-feed-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: var(--text-dim);
}

.cpub-feed-author-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-dim);
}

.cpub-feed-handle {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.cpub-feed-sep {
  color: var(--text-faint);
}

.cpub-feed-time {
  color: var(--text-faint);
}

.cpub-feed-item-stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cpub-feed-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.cpub-feed-stat-btn {
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: inherit;
  transition: all 0.12s;
}
.cpub-feed-stat-btn:hover {
  color: var(--accent);
  background: var(--accent-bg);
  border-color: var(--accent-border);
}
.cpub-feed-stat-voted {
  color: var(--accent);
  border-color: var(--accent-border);
}
</style>
