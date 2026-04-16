<script setup lang="ts">
import type { VoteDirection } from '@commonpub/server';

const props = defineProps<{
  hubSlug: string;
  postId: string;
  voteScore: number;
  userVote?: VoteDirection | null;
}>();

const emit = defineEmits<{
  voted: [result: { voteScore: number; direction: VoteDirection | null }];
}>();

const { isAuthenticated } = useAuth();
const toast = useToast();
const loading = ref(false);
const currentScore = ref(props.voteScore);
const currentVote = ref<VoteDirection | null>(props.userVote ?? null);

watch(() => props.voteScore, (v) => { currentScore.value = v; });
watch(() => props.userVote, (v) => { currentVote.value = v ?? null; });

async function vote(direction: VoteDirection): Promise<void> {
  if (!isAuthenticated.value || loading.value) return;
  loading.value = true;
  try {
    const result = await $fetch<{ voted: boolean; direction: VoteDirection | null; voteScore: number }>(
      `/api/hubs/${props.hubSlug}/posts/${props.postId}/vote`,
      { method: 'POST', body: { direction } },
    );
    currentScore.value = result.voteScore;
    currentVote.value = result.direction;
    emit('voted', { voteScore: result.voteScore, direction: result.direction });
  } catch {
    toast.error('Vote failed');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="cpub-vote-buttons">
    <button
      class="cpub-vote-btn cpub-vote-up"
      :class="{ active: currentVote === 'up' }"
      :disabled="!isAuthenticated || loading"
      :aria-pressed="currentVote === 'up'"
      aria-label="Upvote"
      @click="vote('up')"
    >
      <i class="fa-solid fa-chevron-up"></i>
    </button>
    <span class="cpub-vote-score" :class="{ positive: currentScore > 0, negative: currentScore < 0 }">
      {{ currentScore }}
    </span>
    <button
      class="cpub-vote-btn cpub-vote-down"
      :class="{ active: currentVote === 'down' }"
      :disabled="!isAuthenticated || loading"
      :aria-pressed="currentVote === 'down'"
      aria-label="Downvote"
      @click="vote('down')"
    >
      <i class="fa-solid fa-chevron-down"></i>
    </button>
  </div>
</template>

<style scoped>
.cpub-vote-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.cpub-vote-btn {
  width: 28px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-faint);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
}
.cpub-vote-btn:hover:not(:disabled) { color: var(--text); background: var(--surface2); }
.cpub-vote-btn:disabled { opacity: 0.3; cursor: default; }
.cpub-vote-btn.active { color: var(--accent); }
.cpub-vote-up.active { color: var(--green, var(--accent)); }
.cpub-vote-down.active { color: var(--red, var(--accent)); }

.cpub-vote-score {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  min-width: 20px;
  text-align: center;
}
.cpub-vote-score.positive { color: var(--green, var(--accent)); }
.cpub-vote-score.negative { color: var(--red); }
</style>
