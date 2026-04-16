<script setup lang="ts">
import type { PollOptionResult } from '@commonpub/server';

const props = defineProps<{
  hubSlug: string;
  postId: string;
}>();

const { isAuthenticated } = useAuth();
const toast = useToast();
const loading = ref(false);

const { data, refresh } = await useFetch<{ options: PollOptionResult[]; userVote: string | null }>(
  `/api/hubs/${props.hubSlug}/posts/${props.postId}/poll-options`,
);

const totalVotes = computed(() => {
  if (!data.value) return 0;
  return data.value.options.reduce((sum: number, opt: { voteCount: number }) => sum + opt.voteCount, 0);
});

const hasVoted = computed(() => !!data.value?.userVote);

function percentage(count: number): number {
  if (totalVotes.value === 0) return 0;
  return Math.round((count / totalVotes.value) * 100);
}

async function vote(optionId: string): Promise<void> {
  if (!isAuthenticated.value || loading.value || hasVoted.value) return;
  loading.value = true;
  try {
    await $fetch(`/api/hubs/${props.hubSlug}/posts/${props.postId}/poll-vote`, {
      method: 'POST',
      body: { optionId },
    });
    await refresh();
  } catch {
    toast.error('Failed to submit vote');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="data?.options?.length" class="cpub-poll" role="group" aria-label="Poll">
    <button
      v-for="option in data.options"
      :key="option.id"
      type="button"
      class="cpub-poll-option"
      :class="{ voted: data.userVote === option.id, clickable: !hasVoted && isAuthenticated }"
      :disabled="hasVoted || !isAuthenticated"
      :aria-pressed="data.userVote === option.id"
      :aria-label="`${option.label}${hasVoted ? ` — ${percentage(option.voteCount)}%` : ''}`"
      @click="vote(option.id)"
    >
      <div class="cpub-poll-bar" :style="{ width: hasVoted || !isAuthenticated ? `${percentage(option.voteCount)}%` : '0%' }" />
      <span class="cpub-poll-label">{{ option.label }}</span>
      <span v-if="hasVoted || !isAuthenticated" class="cpub-poll-pct">{{ percentage(option.voteCount) }}%</span>
    </button>
    <div class="cpub-poll-meta">
      {{ totalVotes }} vote{{ totalVotes !== 1 ? 's' : '' }}
    </div>
  </div>
</template>

<style scoped>
.cpub-poll { display: flex; flex-direction: column; gap: 6px; }

.cpub-poll-option {
  position: relative;
  padding: 8px 12px;
  border: var(--border-width-default) solid var(--border);
  background: transparent;
  font-size: 13px;
  font-family: inherit;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  transition: border-color 0.12s;
  text-align: left;
  width: 100%;
}
.cpub-poll-option.clickable { cursor: pointer; }
.cpub-poll-option.clickable:hover { border-color: var(--accent); }
.cpub-poll-option:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.cpub-poll-option.voted { border-color: var(--accent); font-weight: 600; }
.cpub-poll-option:disabled:not(.voted) { opacity: 0.7; cursor: default; }

.cpub-poll-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--accent-bg);
  transition: width 0.3s ease;
  z-index: 0;
}

.cpub-poll-label { position: relative; z-index: 1; flex: 1; }
.cpub-poll-pct { position: relative; z-index: 1; font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }

.cpub-poll-meta { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-top: 2px; }
</style>
