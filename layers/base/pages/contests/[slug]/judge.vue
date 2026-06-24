<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const { user } = useAuth();
const toast = useToast();

import type { Serialized, ContestDetail, ContestEntryItem, ContestJudgeItem, JudgeScoreEntry } from '@commonpub/server';

const { data: contest } = useLazyFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
const { data: judgesData, refresh: refreshJudges } = useLazyFetch<ContestJudgeItem[]>(`/api/contests/${slug}/judges`);
const { data: entriesData, refresh: refreshEntries } = useLazyFetch<{ items: (Serialized<ContestEntryItem> & { judgeScores?: JudgeScoreEntry[] })[]; total: number }>(
  `/api/contests/${slug}/entries`,
  { query: { includeJudgeScores: true } },
);

// The current review stage (multi-round contests). Drives the round label + the
// per-round rubric; falls back to the contest-level rubric when the stage has none.
const currentReviewStage = computed(() => {
  const c = contest.value;
  if (!c || !c.stages?.length) return null;
  const cid = currentStageId(c);
  const st = c.stages.find((s) => s.id === cid);
  return st && st.kind === 'review' ? st : null;
});

// The current review round's id — mirrors the server's per-round tagging exactly
// (normalizeStages-aware, so classic contests resolve to the synthesized core-review).
// Used to pre-fill ONLY this round's score, so a judge entering round 2 doesn't see
// their round-1 score.
const currentRoundId = computed<string | null>(() => {
  const c = contest.value;
  if (!c) return null;
  const cid = currentStageId(c);
  const st = normalizeStages(c).find((s) => s.id === cid);
  return st && st.kind === 'review' ? st.id : null;
});

// The artifact judges review THIS round: the nearest `submission` stage (with a
// template) preceding the current review stage — round 1 reviews the proposal,
// round 2 the prototype. Null for classic contests (no templates), which keeps
// the page byte-identical to pre-artifact behaviour. Flag-gated so disabling
// contestStageSubmissions hides the (server-stripped) artifact boxes entirely.
const { features } = useFeatures();
const artifactStage = computed(() => {
  if (features.value.contestStageSubmissions === false) return null;
  const c = contest.value;
  if (!c || !currentRoundId.value) return null;
  const stages = normalizeStages(c);
  const idx = stages.findIndex((s) => s.id === currentRoundId.value);
  for (let i = idx - 1; i >= 0; i--) {
    const s = stages[i]!;
    if (s.kind === 'submission' && s.submissionTemplate?.length) return s;
  }
  return null;
});

// Judging rubric: per-round criteria if the current review stage defines them,
// else the contest-level rubric. Judges score each criterion (0..max); the overall
// is the normalized weighted sum (computed server-side).
const criteria = computed(() => {
  const stageCrit = currentReviewStage.value?.criteria;
  return (stageCrit && stageCrit.length ? stageCrit : contest.value?.judgingCriteria) ?? [];
});
const hasCriteria = computed(() => criteria.value.length > 0);
function critMax(i: number): number {
  const w = criteria.value[i]?.weight;
  return typeof w === 'number' && w > 0 ? w : 100;
}

useSeoMeta({ title: () => `Judge: ${contest.value?.title || 'Contest'}, ${useSiteName()}` });

// Judge authorization derives from the contest_judges table.
const myJudge = computed(() => (judgesData.value ?? []).find((j) => j.userId === user.value?.id) ?? null);
const pendingInvite = computed(() => !!myJudge.value && !myJudge.value.acceptedAt);
const isGuest = computed(() => myJudge.value?.role === 'guest');
const canScore = computed(() => !!myJudge.value && !!myJudge.value.acceptedAt && !isGuest.value);
const inJudgingPhase = computed(() => contest.value?.status === 'judging');

const accepting = ref(false);
async function acceptInvite(): Promise<void> {
  accepting.value = true;
  try {
    await $fetch(`/api/contests/${slug}/judges/accept`, { method: 'POST' });
    toast.success('Invitation accepted');
    await refreshJudges();
  } catch {
    toast.error('Failed to accept invitation');
  } finally {
    accepting.value = false;
  }
}

const entryList = computed(() => {
  // Cohort scope: once a review stage has culled the field, judges only score the
  // surviving cohort (eliminated entries drop out of later rounds).
  const items = (entriesData.value?.items ?? []).filter((e) => !e.eliminated);
  return items.map((entry) => {
    const myScore = entry.judgeScores?.find((s) => s.judgeId === user.value?.id && (s.roundId ?? null) === currentRoundId.value);
    // This round's artifact, labelled via the stage template (missing optional
    // fields simply don't appear).
    const sub = artifactStage.value
      ? entry.stageSubmissions?.find((s) => s.stageId === artifactStage.value!.id) ?? null
      : null;
    const artifactRows = sub
      ? (artifactStage.value!.submissionTemplate ?? [])
          .filter((f) => sub.fields[f.key])
          .map((f) => ({ key: f.key, label: f.label, type: f.type, value: sub.fields[f.key]! }))
      : [];
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
      myCriteriaScores: myScore?.criteriaScores ?? null,
      artifactRows,
      hasArtifact: !!sub,
    };
  });
});

const scoredCount = computed(() => entryList.value.filter((e) => e.myScore !== null).length);
const totalCount = computed(() => entryList.value.length);
const progressPct = computed(() => totalCount.value > 0 ? Math.round((scoredCount.value / totalCount.value) * 100) : 0);

const scoring = ref<Record<string, number>>({});
const critScoring = ref<Record<string, number[]>>({}); // per entry → [criterionScore...]
const feedback = ref<Record<string, string>>({});
const submitting = ref<string | null>(null);
// Per-card save status (announced via aria-live) so a judge sees the result next
// to the entry they just scored, not in one banner far up the page (G8).
const saveStatus = ref<Record<string, { ok: boolean; msg: string }>>({});

// Pre-fill from existing scores
watch(entryList, (list) => {
  for (const entry of list) {
    if (entry.myScore !== null && scoring.value[entry.id] === undefined) {
      scoring.value[entry.id] = entry.myScore;
    }
    if (entry.myFeedback && feedback.value[entry.id] === undefined) {
      feedback.value[entry.id] = entry.myFeedback;
    }
    if (hasCriteria.value && critScoring.value[entry.id] === undefined) {
      // seed from a prior per-criterion submission, aligned by index
      critScoring.value[entry.id] = criteria.value.map((c, i) =>
        entry.myCriteriaScores?.[i]?.score ?? 0,
      );
    }
  }
}, { immediate: true });

// Live preview of the normalized overall when scoring by criteria.
function critTotal(entryId: string): number {
  const vals = critScoring.value[entryId] ?? [];
  const totalMax = criteria.value.reduce((s, _c, i) => s + critMax(i), 0);
  if (totalMax <= 0) return 0;
  const sum = criteria.value.reduce((s, _c, i) => s + Math.min(Math.max(vals[i] ?? 0, 0), critMax(i)), 0);
  return Math.round((sum / totalMax) * 100);
}

function setStatus(entryId: string, ok: boolean, msg: string): void {
  saveStatus.value[entryId] = { ok, msg };
}

async function submitScore(entryId: string): Promise<void> {
  if (!inJudgingPhase.value) {
    setStatus(entryId, false, 'Scoring is only open during the judging phase.');
    return;
  }

  let body: Record<string, unknown>;
  if (hasCriteria.value) {
    const vals = critScoring.value[entryId] ?? [];
    const criteriaScores = criteria.value.map((c, i) => ({
      label: c.label,
      score: Math.round(vals[i] ?? 0),
      max: critMax(i),
    }));
    if (criteriaScores.some((c) => c.score < 0 || c.score > c.max)) {
      setStatus(entryId, false, 'Each criterion score must be between 0 and its maximum.');
      return;
    }
    body = { entryId, criteriaScores, feedback: feedback.value[entryId] || undefined };
  } else {
    const score = scoring.value[entryId];
    if (score === undefined || score < 0 || score > 100) {
      setStatus(entryId, false, 'Score must be between 0 and 100.');
      return;
    }
    body = { entryId, score, feedback: feedback.value[entryId] || undefined };
  }

  submitting.value = entryId;
  try {
    await $fetch(`/api/contests/${slug}/judge`, { method: 'POST', body });
    setStatus(entryId, true, 'Score saved.');
    await refreshEntries().catch(() => setStatus(entryId, true, 'Score saved, refresh to see the updated totals.'));
  } catch (err: unknown) {
    setStatus(entryId, false, (err as { data?: { message?: string } })?.data?.message || 'Failed to submit score.');
  } finally {
    submitting.value = null;
  }
}
</script>

<template>
  <!-- Auth-gated tool page (no SEO); ClientOnly avoids the lazy-fetch SSR/CSR
       hydration race on the scoring controls (same rationale as the editor). -->
  <ClientOnly>
  <div class="cpub-judge-page">
    <header class="cpub-judge-header">
      <NuxtLink :to="`/contests/${slug}`" class="cpub-judge-back">
        <i class="fa-solid fa-arrow-left"></i> Back to contest
      </NuxtLink>
      <h1 class="cpub-judge-title">
        <i class="fa-solid fa-gavel cpub-judge-icon"></i>
        Judge: {{ contest?.title || 'Contest' }}
        <span v-if="currentReviewStage" class="cpub-judge-round">{{ currentReviewStage.name }}</span>
      </h1>
      <p class="cpub-judge-desc">
        Score each entry from 0 to 100. Add optional feedback. Scores are saved immediately.
        <template v-if="currentReviewStage"> You're judging the <strong>{{ entryList.length }}</strong> {{ entryList.length === 1 ? 'entry' : 'entries' }} still in this round.</template>
      </p>
    </header>

    <!-- Loading -->
    <div v-if="!contest || !judgesData" class="cpub-judge-empty">
      <p>Loading...</p>
    </div>

    <!-- Not a judge -->
    <div v-else-if="!myJudge" class="cpub-judge-unauthorized">
      <i class="fa-solid fa-lock"></i>
      <p>You are not a judge for this contest.</p>
      <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-btn-sm">Back to Contest</NuxtLink>
    </div>

    <!-- Pending invitation -->
    <div v-else-if="pendingInvite" class="cpub-judge-unauthorized">
      <i class="fa-solid fa-envelope-open-text"></i>
      <p>You've been invited to judge this contest. Accept to begin scoring.</p>
      <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="accepting" @click="acceptInvite">
        {{ accepting ? 'Accepting...' : 'Accept invitation' }}
      </button>
    </div>

    <!-- Guest judge (view-only) -->
    <div v-else-if="isGuest" class="cpub-judge-unauthorized">
      <i class="fa-solid fa-eye"></i>
      <p>You are a guest judge and can view entries but cannot submit scores.</p>
      <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-btn-sm">Back to Contest</NuxtLink>
    </div>

    <template v-else>
      <!-- Judging not open yet -->
      <div v-if="!inJudgingPhase" class="cpub-judge-notice" role="status">
        <i class="fa-solid fa-circle-info"></i>
        Scoring opens when the contest enters the judging phase (currently <strong>{{ contest.status }}</strong>).
      </div>

      <!-- Rubric guidance (per-round criteria when the current review stage defines them) -->
      <div v-if="criteria.length" class="cpub-judge-rubric">
        <ContestJudgingCriteria :criteria="criteria" compact />
      </div>

      <!-- Progress bar -->
      <div v-if="totalCount > 0" class="cpub-judge-progress">
        <div class="cpub-judge-progress-label">
          Scored <strong>{{ scoredCount }}</strong> / <strong>{{ totalCount }}</strong> entries
        </div>
        <div class="cpub-judge-progress-bar">
          <div class="cpub-judge-progress-fill" :style="{ width: `${progressPct}%` }"></div>
        </div>
      </div>

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
            <NuxtLink :to="`/contests/${slug}/entries/${entry.id}`" class="cpub-judge-entry-link" target="_blank" style="margin-left: 10px;">
              <i class="fa-solid fa-file-lines"></i> All submissions
            </NuxtLink>

            <!-- This round's artifact (the proposal / prototype fields) -->
            <div v-if="artifactStage" class="cpub-judge-artifact">
              <div class="cpub-judge-artifact-head">{{ artifactStage.name }} submission</div>
              <dl v-if="entry.hasArtifact && entry.artifactRows.length" class="cpub-judge-artifact-fields">
                <template v-for="row in entry.artifactRows" :key="row.key">
                  <dt>{{ row.label }}</dt>
                  <dd>
                    <a v-if="row.type === 'url'" :href="row.value" target="_blank" rel="noopener noreferrer nofollow">{{ row.value }}</a>
                    <span v-else>{{ row.value }}</span>
                  </dd>
                </template>
              </dl>
              <p v-else class="cpub-judge-artifact-none">Nothing submitted for this stage.</p>
            </div>
          </div>
          <div class="cpub-judge-entry-scoring">
            <div v-if="entry.myScore !== null" class="cpub-judge-current-score">
              <span class="cpub-judge-score-label">Your Score</span>
              <span class="cpub-judge-score-value">{{ entry.myScore }}</span>
            </div>
            <div class="cpub-judge-score-controls">
              <!-- Per-criterion scoring (when the contest defines a rubric) -->
              <fieldset v-if="hasCriteria && critScoring[entry.id]" class="cpub-judge-criteria-inputs">
                <legend class="cpub-sr-only">Scores by criterion for {{ entry.contentTitle }}</legend>
                <div v-for="(crit, i) in criteria" :key="i" class="cpub-judge-crit-row">
                  <label :for="`crit-${entry.id}-${i}`" class="cpub-judge-crit-label">{{ crit.label }}</label>
                  <div class="cpub-judge-crit-input-wrap">
                    <input
                      :id="`crit-${entry.id}-${i}`"
                      v-model.number="critScoring[entry.id][i]"
                      type="number"
                      class="cpub-judge-crit-input"
                      min="0"
                      :max="critMax(i)"
                      :aria-label="`${crit.label} score, max ${critMax(i)}`"
                    />
                    <span class="cpub-judge-crit-max">/ {{ critMax(i) }}</span>
                  </div>
                </div>
                <div class="cpub-judge-crit-total">Overall <strong>{{ critTotal(entry.id) }}</strong> / 100</div>
              </fieldset>

              <div class="cpub-judge-score-input-wrap">
                <input
                  v-if="!hasCriteria"
                  v-model.number="scoring[entry.id]"
                  type="number"
                  class="cpub-judge-score-input"
                  min="0"
                  max="100"
                  placeholder="0-100"
                  :aria-label="`Overall score for ${entry.contentTitle}, 0 to 100`"
                />
                <button
                  class="cpub-judge-score-btn"
                  :disabled="submitting === entry.id || !inJudgingPhase"
                  @click="submitScore(entry.id)"
                >
                  {{ submitting === entry.id ? '...' : entry.myScore !== null ? 'Update' : 'Score' }}
                </button>
              </div>
              <label :for="`fb-${entry.id}`" class="cpub-sr-only">Feedback for {{ entry.contentTitle }}</label>
              <textarea
                :id="`fb-${entry.id}`"
                v-model="feedback[entry.id]"
                class="cpub-judge-feedback"
                placeholder="Optional feedback (max 2000 chars)"
                maxlength="2000"
                rows="2"
              ></textarea>
              <p
                v-if="saveStatus[entry.id]"
                class="cpub-judge-save-status"
                :class="saveStatus[entry.id]!.ok ? 'is-ok' : 'is-err'"
                role="status"
                aria-live="polite"
              >
                <i :class="saveStatus[entry.id]!.ok ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'"></i>
                {{ saveStatus[entry.id]!.msg }}
              </p>
              <p v-else-if="!inJudgingPhase" class="cpub-judge-save-status is-muted">
                Scoring opens in the judging phase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
  </ClientOnly>
</template>

<style scoped>
.cpub-judge-page { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
.cpub-judge-header { margin-bottom: 24px; }
.cpub-judge-back { font-size: 12px; color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.cpub-judge-back:hover { color: var(--accent); }
.cpub-judge-title { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.cpub-judge-icon { color: var(--accent); font-size: 18px; }
.cpub-judge-round { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .08em; color: var(--accent); border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 3px 9px; border-radius: var(--radius); }
.cpub-judge-desc { font-size: 13px; color: var(--text-dim); margin-top: 6px; }

.cpub-judge-unauthorized { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cpub-judge-unauthorized i { font-size: 24px; }

.cpub-judge-notice { display: flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border); }
.cpub-judge-notice i { color: var(--accent); }
.cpub-judge-rubric { margin-bottom: 20px; }

.cpub-judge-progress { margin-bottom: 20px; }
.cpub-judge-progress-label { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 6px; }
.cpub-judge-progress-bar { height: 6px; background: var(--surface2); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); overflow: hidden; }
.cpub-judge-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }

.cpub-judge-alert { padding: 10px 14px; font-size: 12px; border: var(--border-width-default) solid; margin-bottom: 16px; }
.cpub-judge-alert--error { background: var(--red-bg); color: var(--red-text); border-color: var(--red); }
.cpub-judge-alert--success { background: var(--green-bg); color: var(--green-text); border-color: var(--green); }

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

.cpub-judge-artifact { margin-top: 10px; border: var(--border-width-default) dashed var(--border2); background: var(--surface2); }
.cpub-judge-artifact-head { font-size: 9px; font-family: var(--font-mono); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); padding: 6px 10px; border-bottom: var(--border-width-default) dashed var(--border2); }
.cpub-judge-artifact-fields { margin: 0; padding: 8px 10px; display: grid; grid-template-columns: minmax(90px, 130px) 1fr; gap: 4px 10px; }
.cpub-judge-artifact-fields dt { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-faint); }
.cpub-judge-artifact-fields dd { margin: 0; font-size: 12px; color: var(--text); line-height: 1.5; white-space: pre-line; overflow-wrap: anywhere; }
.cpub-judge-artifact-fields dd a { color: var(--accent); }
.cpub-judge-artifact-none { font-size: 11px; color: var(--text-faint); margin: 0; padding: 8px 10px; }

.cpub-judge-entry-scoring { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; min-width: 220px; }
.cpub-judge-current-score { text-align: center; }
.cpub-judge-score-label { display: block; font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); text-transform: uppercase; }
.cpub-judge-score-value { font-size: 20px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); }
.cpub-judge-score-controls { display: flex; flex-direction: column; gap: 6px; }
.cpub-judge-criteria-inputs { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: var(--border-width-default) dashed var(--border); background: var(--surface2); margin: 0 0 2px; min-inline-size: 0; }
.cpub-judge-crit-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cpub-judge-crit-label { font-size: 11px; color: var(--text-dim); flex: 1; min-width: 0; }
.cpub-judge-crit-input-wrap { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.cpub-judge-crit-input { width: 52px; padding: 4px 6px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 12px; font-family: var(--font-mono); text-align: center; outline: none; }
.cpub-judge-crit-input:focus { border-color: var(--accent); }
.cpub-judge-crit-max { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-judge-crit-total { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); text-align: right; padding-top: 4px; border-top: var(--border-width-default) solid var(--border); }
.cpub-judge-crit-total strong { color: var(--accent); font-size: 13px; }
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
.cpub-judge-save-status { display: flex; align-items: center; gap: 5px; margin: 2px 0 0; font-size: 11px; font-family: var(--font-mono); }
.cpub-judge-save-status.is-ok { color: var(--green-text); }
.cpub-judge-save-status.is-err { color: var(--red-text); }
.cpub-judge-save-status.is-muted { color: var(--text-faint); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (max-width: 768px) {
  .cpub-judge-entry { flex-direction: column; }
  .cpub-judge-entry-scoring { min-width: 100%; }
}
</style>
