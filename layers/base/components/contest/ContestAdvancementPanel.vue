<script setup lang="ts">
/**
 * ContestAdvancementPanel — the edit-only Top-N / manual cohort cut, extracted from
 * ContestEditor. Crucially it operates on the PERSISTED review stages + REAL entries
 * (not the editable `stages` model), so it self-fetches entries and takes the
 * persisted review stages as a prop; the parent passes `contest.value.stages`
 * filtered to review. Emits `advanced` after a cut so the parent refetches the
 * contest. Mounted inside the Stages tab, below the stage editor.
 */
import type { ContestStage } from '@commonpub/schema';
import type { ContestJudgeItem, JudgeScoreEntry } from '@commonpub/server';

type ReviewStage = Pick<ContestStage, 'id' | 'name' | 'advanceCount'>;
interface EntryLite {
  id: string;
  contentTitle: string;
  authorName?: string;
  score?: number | null;
  eliminated?: boolean;
  judgeScores?: JudgeScoreEntry[];
  contentStatus?: string;
}

const props = defineProps<{
  slug: string;
  reviewStages: ReviewStage[];
  /** The persisted contest: status + stage pointer decide which round can be cut. */
  contest: {
    status: string;
    stages?: ContestStage[] | null;
    currentStageId?: string | null;
    startDate: string;
    endDate: string;
    judgingEndDate?: string | null;
  };
}>();
const emit = defineEmits<{ advanced: [] }>();

const toast = useToast();
const { extract: extractError } = useApiError();

// EVERY entry (the route defaults to 20, which hid the rest from the manual
// picker), with per-judge scores so the organizer can see who has judged what
// before making a cut. The route only returns judgeScores to the owner, a
// contest.manage holder or a panel judge, which is everyone who sees this panel.
const { data: entriesData, refresh: refreshEntries } = useLazyAsyncData(
  `advance-entries-${props.slug}`,
  () => fetchAllPages<EntryLite>((offset, limit) =>
    $fetch<{ items: EntryLite[]; total: number }>(`/api/contests/${props.slug}/entries`, {
      query: { includeJudgeScores: true, limit, offset },
    }),
  ),
  { server: false },
);
const eligibleEntries = computed(() => (entriesData.value?.items ?? []).filter((e) => !e.eliminated));

const { data: judgesData } = useLazyFetch<ContestJudgeItem[]>(() => `/api/contests/${props.slug}/judges`, { server: false });
const judgeName = computed(() => new Map((judgesData.value ?? []).map((j) => [j.userId, j.userName])));
// Judges who can actually score: accepted, not guests.
const scoringJudgeCount = computed(() => (judgesData.value ?? []).filter((j) => j.acceptedAt && j.role !== 'guest').length);

/**
 * One review round's scores per entry, highest average first. Scores are
 * matched on `roundId`, the same tag the server writes, so a later round never
 * shows an earlier round's numbers. Unscored entries sort last.
 */
function roundRows(stageId: string): Array<{ id: string; title: string; author: string; avg: number | null; scores: Array<{ judge: string; score: number; feedback: string }>; unpublished: boolean }> {
  return eligibleEntries.value
    .map((e) => {
      const scores = (e.judgeScores ?? [])
        .filter((s) => s.roundId === stageId)
        .map((s) => ({ judge: judgeName.value.get(s.judgeId) ?? 'Removed judge', score: s.score, feedback: s.feedback ?? '' }));
      const avg = scores.length ? Math.round(scores.reduce((t, s) => t + s.score, 0) / scores.length) : null;
      return { id: e.id, title: e.contentTitle, author: e.authorName ?? '', avg, scores, unpublished: !!e.contentStatus && e.contentStatus !== 'published' };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || a.title.localeCompare(b.title));
}
/**
 * The LAST review round decides the winners, and an entry whose project isn't
 * published is missing from the public results (the listing hides drafts). In
 * the walk-through both winners were proposal drafts and the public results
 * page showed neither. Warn before that cut, by name.
 */
function unpublishedFinalists(stageId: string): string[] {
  const c = { ...props.contest, judgingEndDate: props.contest.judgingEndDate ?? null };
  const stages = normalizeStages(c);
  const idx = stages.findIndex((s) => s.id === stageId);
  if (stages.slice(idx + 1).some((s) => s.kind === 'review')) return [];
  return eligibleEntries.value.filter((e) => e.contentStatus && e.contentStatus !== 'published').map((e) => e.contentTitle);
}

function unscoredCount(stageId: string): number {
  return roundRows(stageId).filter((r) => r.scores.length === 0).length;
}

const advancing = ref<string | null>(null);
const advanceN = ref<Record<string, number>>({});
const advanceMode = ref<Record<string, 'topN' | 'manual'>>({});
const manualPick = ref<Record<string, string[]>>({});

function toggleManual(stageId: string, entryId: string): void {
  const cur = manualPick.value[stageId] ?? [];
  manualPick.value[stageId] = cur.includes(entryId) ? cur.filter((x) => x !== entryId) : [...cur, entryId];
}

async function postAdvance(stageId: string, body: Record<string, unknown>): Promise<void> {
  advancing.value = stageId;
  try {
    const r = await $fetch<{ advancedCount: number; eliminatedCount: number }>(
      `/api/contests/${props.slug}/advance`,
      { method: 'POST', body },
    );
    toast.success(`${r.advancedCount} advanced, ${r.eliminatedCount} not advanced.`);
    await refreshEntries();
    emit('advanced');
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    advancing.value = null;
  }
}

/**
 * Which review rounds can be cut right now, mirroring the server
 * (advanceContestStage): only while judging, and only the current round or an
 * earlier one (a re-run, which the server refuses once a later round has
 * started). Every review stage used to show a live Advance button, so pressing
 * the finalists row during round 1 culled the field on round-1 scores.
 */
function cutState(stageId: string): { ok: boolean; why: string } {
  const c = { ...props.contest, judgingEndDate: props.contest.judgingEndDate ?? null };
  if (c.status !== 'judging') return { ok: false, why: 'Cuts open once judging has started.' };
  const stages = normalizeStages(c);
  const idx = stages.findIndex((s) => s.id === stageId);
  const curIdx = stages.findIndex((s) => s.id === currentStageId(c));
  if (idx > curIdx) return { ok: false, why: 'This round hasn’t started yet.' };
  return { ok: true, why: idx === curIdx ? '' : 'Already cut. Running it again recomputes this round’s cut.' };
}

async function advanceStage(stageId: string): Promise<void> {
  const topN = advanceN.value[stageId];
  if (!topN || topN < 1) { toast.error('Enter how many entries advance.'); return; }
  // Fresh numbers: the panel loaded once, and judges may have scored since.
  await refreshEntries();
  // Unscored entries rank below every scored one, so a Top-N cut made while
  // judging is incomplete silently eliminates whatever nobody got to.
  const unscored = unscoredCount(stageId);
  const warn = unscored > 0 && topN < eligibleEntries.value.length
    ? `\n\n${unscored} ${unscored === 1 ? 'entry has' : 'entries have'} no score in this round yet and will rank last.`
    : '';
  const name = props.reviewStages.find((s) => s.id === stageId)?.name ?? 'this round';
  if (!confirm(`Advance the top ${topN} entries from "${name}"? Entries below the cut are marked "not advanced" and drop out of later judging and final results. Every entrant gets a notification. Until the next round has scores you can run it again with a different number, which reinstates or removes entries and notifies everyone again.${warn}`)) return;
  await postAdvance(stageId, { reviewStageId: stageId, mode: 'topN', topN });
}

async function advanceStageManual(stageId: string): Promise<void> {
  const ids = manualPick.value[stageId] ?? [];
  if (!ids.length) { toast.error('Select at least one entry to advance.'); return; }
  await refreshEntries();
  const name = props.reviewStages.find((s) => s.id === stageId)?.name ?? 'this round';
  if (!confirm(`Advance the ${ids.length} selected ${ids.length === 1 ? 'entry' : 'entries'} from "${name}"? The rest of the field is marked "not advanced" and drops out of later judging and final results. Every entrant gets a notification.`)) return;
  await postAdvance(stageId, { reviewStageId: stageId, mode: 'manual', advancedEntryIds: ids });
}

// Prefill each review stage's Top-N from its persisted advanceCount, when present.
watch(() => props.reviewStages, (stages) => {
  for (const s of stages) {
    if (typeof s.advanceCount === 'number' && advanceN.value[s.id] === undefined) advanceN.value[s.id] = s.advanceCount;
  }
}, { immediate: true });
</script>

<template>
  <div v-if="reviewStages.length" class="cpub-advance-section">
    <h3 class="cpub-form-subtitle"><i class="fa-solid fa-arrow-up-right-dots"></i> Advancement</h3>
    <p class="cpub-form-hint">When a round's judging is done, advance the top entries to the next stage. Entries below the cut are marked "not advanced". Only the round that's open can be cut, and until the next round has scores a cut can be run again to correct it. (Save any stage changes above first.)</p>
    <button type="button" class="cpub-btn cpub-btn-sm cpub-advance-refresh" @click="refreshEntries()"><i class="fa-solid fa-rotate"></i> Refresh scores</button>
    <div v-for="rs in reviewStages" :key="rs.id" class="cpub-advance-block">
      <div class="cpub-advance-row">
        <span class="cpub-advance-name"><i class="fa-solid fa-gavel"></i> {{ rs.name }}</span>
        <div class="cpub-advance-mode">
          <label class="cpub-form-check"><input type="radio" :name="`mode-${rs.id}`" :checked="(advanceMode[rs.id] ?? 'topN') === 'topN'" @change="advanceMode[rs.id] = 'topN'" /> <span>Top N</span></label>
          <label class="cpub-form-check"><input type="radio" :name="`mode-${rs.id}`" :checked="advanceMode[rs.id] === 'manual'" @change="advanceMode[rs.id] = 'manual'" /> <span>Pick manually</span></label>
        </div>
      </div>
      <p v-if="cutState(rs.id).why" class="cpub-form-hint cpub-advance-why">{{ cutState(rs.id).why }}</p>
      <p v-if="cutState(rs.id).ok && unpublishedFinalists(rs.id).length" class="cpub-advance-warn" role="note">
        <i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
        Not published yet: {{ unpublishedFinalists(rs.id).join(', ') }}. This round decides the winners, and an unpublished project doesn't appear in the public results. Ask these entrants to publish before you complete the contest.
      </p>
      <!-- Who has judged what, before any cut is made. -->
      <details class="cpub-advance-scores">
        <summary>
          Scores and feedback
          <span class="cpub-advance-scores-meta">
            {{ eligibleEntries.length - unscoredCount(rs.id) }} of {{ eligibleEntries.length }} entries scored
            <template v-if="scoringJudgeCount"> · {{ scoringJudgeCount }} {{ scoringJudgeCount === 1 ? 'judge' : 'judges' }} on the panel</template>
          </span>
        </summary>
        <p v-if="!eligibleEntries.length" class="cpub-form-hint" style="margin: 8px 0 0;">No entries in the current cohort yet.</p>
        <ol v-else class="cpub-advance-score-list">
          <li v-for="row in roundRows(rs.id)" :key="row.id" class="cpub-advance-score-row">
            <div class="cpub-advance-score-head">
              <NuxtLink :to="`/contests/${slug}/entries/${row.id}`" target="_blank" class="cpub-advance-score-title">{{ row.title }}</NuxtLink>
              <span v-if="row.author" class="cpub-advance-score-author">{{ row.author }}</span>
              <span v-if="row.unpublished" class="cpub-advance-draft">Not published</span>
              <span class="cpub-advance-score-avg">{{ row.avg ?? 'not scored' }}<template v-if="row.avg !== null"> avg · {{ row.scores.length }} of {{ Math.max(scoringJudgeCount, row.scores.length) }}</template></span>
            </div>
            <ul v-if="row.scores.length" class="cpub-advance-score-judges">
              <li v-for="(s, i) in row.scores" :key="i">
                <strong>{{ s.judge }}</strong> {{ s.score }}<template v-if="s.feedback">: <span class="cpub-advance-score-fb">{{ s.feedback }}</span></template>
              </li>
            </ul>
          </li>
        </ol>
      </details>

      <div v-if="(advanceMode[rs.id] ?? 'topN') === 'topN'" class="cpub-advance-ctl">
        <label class="cpub-form-label" :for="`adv-${rs.id}`">Advance top</label>
        <input :id="`adv-${rs.id}`" v-model.number="advanceN[rs.id]" type="number" min="1" step="1" class="cpub-form-input cpub-advance-n" />
        <button type="button" class="cpub-btn cpub-btn-sm" :disabled="advancing === rs.id || !cutState(rs.id).ok" @click="advanceStage(rs.id)">
          <i class="fa-solid fa-arrow-up-right-dots"></i> {{ advancing === rs.id ? 'Advancing…' : `Advance ${rs.name}` }}
        </button>
      </div>
      <div v-else class="cpub-advance-manual">
        <p v-if="!eligibleEntries.length" class="cpub-form-hint" style="margin: 0;">No entries in the current cohort to pick from yet.</p>
        <template v-else>
          <label v-for="e in eligibleEntries" :key="e.id" class="cpub-advance-pick">
            <input type="checkbox" :checked="(manualPick[rs.id] ?? []).includes(e.id)" @change="toggleManual(rs.id, e.id)" />
            <span class="cpub-advance-pick-title">{{ e.contentTitle }}</span>
            <span v-if="e.score != null" class="cpub-advance-pick-score">{{ e.score }}</span>
          </label>
          <button type="button" class="cpub-btn cpub-btn-sm" :disabled="advancing === rs.id || !(manualPick[rs.id] ?? []).length || !cutState(rs.id).ok" @click="advanceStageManual(rs.id)">
            <i class="fa-solid fa-arrow-up-right-dots"></i> {{ advancing === rs.id ? 'Advancing…' : `Advance ${(manualPick[rs.id] ?? []).length} selected` }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Advancement styles travel with the markup (scoped CSS is per component). The
   form control .cpub-form-input / :focus + .cpub-form-label/-hint/-btn come from
   the global theme (.cpub-form-input hoisted to forms.css, session 246). */
.cpub-form-subtitle { font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
.cpub-form-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
.cpub-form-check input { width: 14px; height: 14px; flex-shrink: 0; }

.cpub-advance-section { margin-top: 20px; padding-top: 16px; border-top: var(--border-width-default) solid var(--border2); }
.cpub-advance-block { padding: 12px 0; border-top: var(--border-width-default) solid var(--border); }
.cpub-advance-block:first-of-type { border-top: 0; }
.cpub-advance-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cpub-advance-name { font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }
.cpub-advance-name i { color: var(--accent); font-size: 11px; }
.cpub-advance-mode { display: inline-flex; gap: 12px; }
.cpub-advance-ctl { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; }
.cpub-advance-ctl .cpub-form-label { margin: 0; }
.cpub-advance-n { width: 80px; }
.cpub-advance-manual { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.cpub-advance-pick { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); padding: 4px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface2); cursor: pointer; }
.cpub-advance-pick-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-advance-pick-score { font-family: var(--font-mono); font-size: 11px; color: var(--accent); flex-shrink: 0; }
.cpub-advance-manual .cpub-btn { align-self: flex-start; margin-top: 6px; }
.cpub-advance-scores { margin-top: 10px; border: var(--border-width-default) solid var(--border); background: var(--surface2); padding: 8px 10px; }
/* list-item, not flex: a flex summary drops the disclosure triangle, leaving
   nothing to say the section opens. */
.cpub-advance-scores summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text); display: list-item; }
.cpub-advance-scores-meta { margin-left: 8px; }
.cpub-advance-why { margin: 6px 0 0; }
.cpub-advance-warn { display: flex; gap: 8px; align-items: flex-start; margin: 8px 0 0; padding: 8px 10px; font-size: 12px; color: var(--text); background: var(--yellow-bg); border: var(--border-width-default) solid var(--border); }
.cpub-advance-draft { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-dim); border: var(--border-width-default) solid var(--border); padding: 0 5px; }
.cpub-advance-refresh { margin-bottom: 8px; }
.cpub-advance-scores-meta { font-family: var(--font-mono); font-size: 11px; font-weight: 400; color: var(--text-dim); }
.cpub-advance-score-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cpub-advance-score-row { padding: 6px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface); }
.cpub-advance-score-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 12px; }
.cpub-advance-score-title { color: var(--accent); font-weight: 600; overflow-wrap: anywhere; }
.cpub-advance-score-author { color: var(--text-dim); font-size: 11px; }
.cpub-advance-score-avg { margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
.cpub-advance-score-judges { list-style: none; margin: 4px 0 0; padding: 0; font-size: 11px; color: var(--text-dim); display: flex; flex-direction: column; gap: 2px; }
.cpub-advance-score-fb { white-space: pre-line; overflow-wrap: anywhere; }
</style>
