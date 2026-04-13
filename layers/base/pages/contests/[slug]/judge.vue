<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const { user } = useAuth();

import type { Serialized, ContestDetail, ContestEntryItem } from '@commonpub/server';

const { data: contest } = useLazyFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
const { data: entriesData, refresh: refreshEntries } = useLazyFetch<{ items: (Serialized<ContestEntryItem> & { judgeScores?: Array<{ judgeId: string; score: number; feedback?: string }> })[]; total: number }>(
  `/api/contests/${slug}/entries`,
  { query: { includeJudgeScores: true } },
);

useSeoMeta({ title: () => `Judge: ${contest.value?.title || 'Contest'} — ${useSiteName()}` });

const isJudge = computed(() => {
  if (!contest.value || !user.value) return false;
  return ((contest.value.judges ?? []) as string[]).includes(user.value.id);
});

const entryList = computed(() => {
  const items = entriesData.value?.items ?? [];
  return items.map((entry) => {
    const myScore = entry.judgeScores?.find((s) => s.judgeId === user.value?.id);
    return {
      id: entry.id,
      contentId: entry.contentId,
      contentSlug: entry.contentSlug,
      contentType: entry.contentType,
      contentTitle: entry.contentTitle,
      authorName: entry.authorName,
      authorUsername: entry.authorUsername,
      score: entry.score ?? null,
      rank: entry.rank ?? null,
      myScore: myScore?.score ?? null,
      myFeedback: myScore?.feedback ?? '',
    };
  });
});

const scoredCount = computed(() => entryList.value.filter((e) => e.myScore !== null).length);
const totalCount = computed(() => entryList.value.length);
const progressPct = computed(() => totalCount.value > 0 ? Math.round((scoredCount.value / totalCount.value) * 100) : 0);

const scoring = ref<Record<string, number>>({});
const feedback = ref<Record<string, string>>({});
const submitting = ref<string | null>(null);
const error = ref('');
const success = ref('');

// Pre-fill from existing scores
watch(entryList, (list) => {
  for (const entry of list) {
    if (entry.myScore !== null && scoring.value[entry.id] === undefined) {
      scoring.value[entry.id] = entry.myScore;
    }
    if (entry.myFeedback && feedback.value[entry.id] === undefined) {
      feedback.value[entry.id] = entry.myFeedback;
    }
  }
}, { immediate: true });

async function submitScore(entryId: string): Promise<void> {
  const score = scoring.value[entryId];
  if (score === undefined || score < 1 || score > 100) {
    error.value = 'Score must be between 1 and 100.';
    return;
  }

  error.value = '';
  success.value = '';
  submitting.value = entryId;

  try {
    await $fetch(`/api/contests/${slug}/judge`, {
      method: 'POST',
      body: {
        entryId,
        score,
        feedback: feedback.value[entryId] || undefined,
      },
    });
    success.value = 'Score submitted for entry.';
    await refreshEntries();
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message || 'Failed to submit score.';
  } finally {
    submitting.value = null;
  }
}
</script>

<template>
  <div class="cpub-judge-page">
    <header class="cpub-judge-header">
      <NuxtLink :to="`/contests/${slug}`" class="cpub-judge-back">
        <i class="fa-solid fa-arrow-left"></i> Back to contest
      </NuxtLink>
      <h1 class="cpub-judge-title">
        <i class="fa-solid fa-gavel cpub-judge-icon"></i>
        Judge: {{ contest?.title || 'Contest' }}
      </h1>
      <p class="cpub-judge-desc">Score each entry from 1 to 100. Add optional feedback. Scores are saved immediately.</p>
    </header>

    <!-- Loading -->
    <div v-if="!contest" class="cpub-judge-empty">
      <p>Loading...</p>
    </div>

    <!-- Auth guard -->
    <div v-else-if="!isJudge" class="cpub-judge-unauthorized">
      <i class="fa-solid fa-lock"></i>
      <p>You are not a judge for this contest.</p>
      <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-btn-sm">Back to Contest</NuxtLink>
    </div>

    <template v-else>
      <!-- Progress bar -->
      <div v-if="totalCount > 0" class="cpub-judge-progress">
        <div class="cpub-judge-progress-label">
          Scored <strong>{{ scoredCount }}</strong> / <strong>{{ totalCount }}</strong> entries
        </div>
        <div class="cpub-judge-progress-bar">
          <div class="cpub-judge-progress-fill" :style="{ width: `${progressPct}%` }"></div>
        </div>
      </div>

      <div v-if="error" class="cpub-judge-alert cpub-judge-alert--error" role="alert">{{ error }}</div>
      <div v-if="success" class="cpub-judge-alert cpub-judge-alert--success">{{ success }}</div>

      <div v-if="entryList.length === 0" class="cpub-judge-empty">
        <i class="fa-solid fa-inbox"></i>
        <p>No entries to judge yet.</p>
      </div>

      <div v-else class="cpub-judge-entries">
        <div v-for="entry in entryList" :key="entry.id" class="cpub-judge-entry">
          <div class="cpub-judge-entry-info">
            <div class="cpub-judge-entry-title">{{ entry.contentTitle }}</div>
            <div class="cpub-judge-entry-author">by {{ entry.authorName }}</div>
            <NuxtLink :to="`/u/${entry.authorUsername}/${entry.contentType}/${entry.contentSlug}`" class="cpub-judge-entry-link" target="_blank">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> View entry
            </NuxtLink>
          </div>
          <div class="cpub-judge-entry-scoring">
            <div v-if="entry.myScore !== null" class="cpub-judge-current-score">
              <span class="cpub-judge-score-label">Your Score</span>
              <span class="cpub-judge-score-value">{{ entry.myScore }}</span>
            </div>
            <div class="cpub-judge-score-controls">
              <div class="cpub-judge-score-input-wrap">
                <input
                  v-model.number="scoring[entry.id]"
                  type="number"
                  class="cpub-judge-score-input"
                  min="1"
                  max="100"
                  placeholder="1-100"
                />
                <button
                  class="cpub-judge-score-btn"
                  :disabled="submitting === entry.id"
                  @click="submitScore(entry.id)"
                >
                  {{ submitting === entry.id ? '...' : entry.myScore !== null ? 'Update' : 'Score' }}
                </button>
              </div>
              <textarea
                v-model="feedback[entry.id]"
                class="cpub-judge-feedback"
                placeholder="Optional feedback (max 2000 chars)"
                maxlength="2000"
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cpub-judge-page { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
.cpub-judge-header { margin-bottom: 24px; }
.cpub-judge-back { font-size: 12px; color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.cpub-judge-back:hover { color: var(--accent); }
.cpub-judge-title { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.cpub-judge-icon { color: var(--accent); font-size: 18px; }
.cpub-judge-desc { font-size: 13px; color: var(--text-dim); margin-top: 6px; }

.cpub-judge-unauthorized { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cpub-judge-unauthorized i { font-size: 24px; }

.cpub-judge-progress { margin-bottom: 20px; }
.cpub-judge-progress-label { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 6px; }
.cpub-judge-progress-bar { height: 6px; background: var(--surface2); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); overflow: hidden; }
.cpub-judge-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }

.cpub-judge-alert { padding: 10px 14px; font-size: 12px; border: var(--border-width-default) solid; margin-bottom: 16px; }
.cpub-judge-alert--error { background: var(--red-bg); color: var(--red); border-color: var(--red); }
.cpub-judge-alert--success { background: var(--green-bg); color: var(--green); border-color: var(--green); }

.cpub-judge-empty { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.cpub-judge-empty i { font-size: 24px; }

.cpub-judge-entries { display: flex; flex-direction: column; gap: 12px; }
.cpub-judge-entry {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 16px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
}
.cpub-judge-entry-info { flex: 1; min-width: 0; }
.cpub-judge-entry-title { font-size: 14px; font-weight: 600; color: var(--text); }
.cpub-judge-entry-author { font-size: 11px; color: var(--text-faint); margin-top: 2px; }
.cpub-judge-entry-link { font-size: 10px; color: var(--accent); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; }
.cpub-judge-entry-link:hover { text-decoration: underline; }

.cpub-judge-entry-scoring { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; min-width: 220px; }
.cpub-judge-current-score { text-align: center; }
.cpub-judge-score-label { display: block; font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); text-transform: uppercase; }
.cpub-judge-score-value { font-size: 20px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); }
.cpub-judge-score-controls { display: flex; flex-direction: column; gap: 6px; }
.cpub-judge-score-input-wrap { display: flex; gap: 0; }
.cpub-judge-score-input {
  width: 70px; padding: 6px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface);
  color: var(--text); font-size: 13px; font-family: var(--font-mono); text-align: center; outline: none;
}
.cpub-judge-score-input:focus { border-color: var(--accent); }
.cpub-judge-score-btn {
  padding: 6px 12px; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--accent);
  font-size: 11px; font-weight: 600; cursor: pointer; border-left: none;
}
.cpub-judge-score-btn:hover { opacity: 0.9; }
.cpub-judge-score-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.cpub-judge-feedback {
  width: 100%; padding: 6px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface);
  color: var(--text); font-size: 11px; font-family: inherit; resize: vertical; outline: none;
}
.cpub-judge-feedback:focus { border-color: var(--accent); }

@media (max-width: 768px) {
  .cpub-judge-entry { flex-direction: column; }
  .cpub-judge-entry-scoring { min-width: 100%; }
}
</style>
