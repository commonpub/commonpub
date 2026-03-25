<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;

import type { Serialized, ContestDetail, ContestEntryItem } from '@commonpub/server';

const { data: contest } = useLazyFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
const { data: entriesData, refresh: refreshEntries } = useLazyFetch<{ items: Serialized<ContestEntryItem>[]; total: number }>(`/api/contests/${slug}/entries`);

useSeoMeta({ title: () => `Judge: ${contest.value?.title || 'Contest'} — CommonPub` });

const entryList = computed(() => {
  const items = entriesData.value?.items ?? [];
  return items.map((entry) => ({
    id: entry.id,
    contentId: entry.contentId,
    contentSlug: entry.contentSlug,
    contentType: entry.contentType,
    contentTitle: entry.contentTitle,
    authorName: entry.authorName,
    score: entry.score ?? null,
    rank: entry.rank ?? null,
  }));
});

const scoring = ref<Record<string, number>>({});
const submitting = ref<string | null>(null);
const error = ref('');
const success = ref('');

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
      body: { entryId, score },
    });
    success.value = `Score submitted for entry.`;
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
      <p class="cpub-judge-desc">Score each entry from 1 to 100. Scores are saved immediately.</p>
    </header>

    <div v-if="error" class="cpub-judge-alert cpub-judge-alert--error" role="alert">{{ error }}</div>
    <div v-if="success" class="cpub-judge-alert cpub-judge-alert--success">{{ success }}</div>

    <div v-if="entryList.length === 0" class="cpub-judge-empty">
      <i class="fa-solid fa-inbox" style="font-size: 24px; color: var(--text-faint);"></i>
      <p>No entries to judge yet.</p>
    </div>

    <div v-else class="cpub-judge-entries">
      <div v-for="entry in entryList" :key="entry.id" class="cpub-judge-entry">
        <div class="cpub-judge-entry-info">
          <div class="cpub-judge-entry-title">{{ entry.contentTitle }}</div>
          <div class="cpub-judge-entry-author">by {{ entry.authorName }}</div>
          <NuxtLink :to="`/${entry.contentType}/${entry.contentSlug}`" class="cpub-judge-entry-link" target="_blank">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> View entry
          </NuxtLink>
        </div>
        <div class="cpub-judge-entry-scoring">
          <div v-if="entry.score !== null" class="cpub-judge-current-score">
            <span class="cpub-judge-score-label">Current</span>
            <span class="cpub-judge-score-value">{{ entry.score }}</span>
          </div>
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
              {{ submitting === entry.id ? '...' : 'Score' }}
            </button>
          </div>
        </div>
      </div>
    </div>
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

.cpub-judge-alert { padding: 10px 14px; font-size: 12px; border: 2px solid; margin-bottom: 16px; }
.cpub-judge-alert--error { background: var(--red-bg); color: var(--red); border-color: var(--red); }
.cpub-judge-alert--success { background: var(--green-bg); color: var(--green); border-color: var(--green); }

.cpub-judge-empty { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }

.cpub-judge-entries { display: flex; flex-direction: column; gap: 8px; }
.cpub-judge-entry {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 16px; background: var(--surface); border: 2px solid var(--border);
  box-shadow: 4px 4px 0 var(--border);
}
.cpub-judge-entry-info { flex: 1; min-width: 0; }
.cpub-judge-entry-title { font-size: 14px; font-weight: 600; color: var(--text); }
.cpub-judge-entry-author { font-size: 11px; color: var(--text-faint); margin-top: 2px; }
.cpub-judge-entry-link { font-size: 10px; color: var(--accent); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; }
.cpub-judge-entry-link:hover { text-decoration: underline; }

.cpub-judge-entry-scoring { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.cpub-judge-current-score { text-align: center; }
.cpub-judge-score-label { display: block; font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); text-transform: uppercase; }
.cpub-judge-score-value { font-size: 20px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); }
.cpub-judge-score-input-wrap { display: flex; gap: 0; }
.cpub-judge-score-input {
  width: 70px; padding: 6px 8px; border: 2px solid var(--border); background: var(--surface);
  color: var(--text); font-size: 13px; font-family: var(--font-mono); text-align: center; outline: none;
}
.cpub-judge-score-input:focus { border-color: var(--accent); }
.cpub-judge-score-btn {
  padding: 6px 12px; background: var(--accent); color: var(--color-text-inverse); border: 2px solid var(--accent);
  font-size: 11px; font-weight: 600; cursor: pointer; border-left: none;
}
.cpub-judge-score-btn:hover { opacity: 0.9; }
.cpub-judge-score-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
