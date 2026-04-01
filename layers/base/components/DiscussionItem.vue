<script setup lang="ts">
const props = defineProps<{
  title: string;
  author: string;
  replyCount: number;
  voteCount: number;
  lastReplyAt?: Date;
  solved?: boolean;
}>();

const emit = defineEmits<{
  upvote: [];
  downvote: [];
}>();

const lastReplyFormatted = computed((): string | null => {
  if (!props.lastReplyAt) return null;
  return new Date(props.lastReplyAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
});
</script>

<template>
  <div :class="['cpub-discussion-item', { 'cpub-discussion-solved': solved }]">
    <div class="cpub-discussion-votes">
      <button
        class="cpub-vote-btn"
        aria-label="Upvote"
        @click="emit('upvote')"
      >
        <i class="fa-solid fa-chevron-up"></i>
      </button>
      <span class="cpub-vote-count">{{ voteCount }}</span>
      <button
        class="cpub-vote-btn"
        aria-label="Downvote"
        @click="emit('downvote')"
      >
        <i class="fa-solid fa-chevron-down"></i>
      </button>
    </div>

    <div class="cpub-discussion-content">
      <div class="cpub-discussion-title-row">
        <h4 class="cpub-discussion-title">{{ title }}</h4>
        <span v-if="solved" class="cpub-discussion-solved-badge">
          <i class="fa-solid fa-check"></i> Solved
        </span>
      </div>
      <div class="cpub-discussion-meta">
        <span class="cpub-discussion-author">{{ author }}</span>
        <span class="cpub-discussion-sep" aria-hidden="true">&middot;</span>
        <span class="cpub-discussion-replies">
          <i class="fa-solid fa-comment"></i> {{ replyCount }} replies
        </span>
        <template v-if="lastReplyFormatted">
          <span class="cpub-discussion-sep" aria-hidden="true">&middot;</span>
          <span class="cpub-discussion-last-reply">last reply {{ lastReplyFormatted }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-discussion-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  transition: background var(--transition-fast);
}

.cpub-discussion-item:hover {
  background: var(--surface2);
}

.cpub-discussion-solved {
  border-left: 3px solid var(--green);
}

.cpub-discussion-votes {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  min-width: 36px;
}

.cpub-vote-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  background: none;
  border: var(--border-width-default) solid var(--border2);
  color: var(--text-faint);
  cursor: pointer;
  font-size: var(--text-xs);
  transition: all var(--transition-fast);
}

.cpub-vote-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}

.cpub-vote-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.cpub-vote-count {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text);
  line-height: 1;
  padding: 2px 0;
}

.cpub-discussion-content {
  flex: 1;
  min-width: 0;
}

.cpub-discussion-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cpub-discussion-title {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  line-height: var(--leading-tight);
}

.cpub-discussion-solved-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--green);
  background: var(--green-bg);
  border: var(--border-width-default) solid var(--green-border);
}

.cpub-discussion-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-faint);
  flex-wrap: wrap;
}

.cpub-discussion-author {
  font-weight: var(--font-weight-medium);
  color: var(--text-dim);
}

.cpub-discussion-sep {
  color: var(--text-faint);
}

.cpub-discussion-replies {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-discussion-last-reply {
  color: var(--text-faint);
}
</style>
