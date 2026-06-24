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

type ReviewStage = Pick<ContestStage, 'id' | 'name' | 'advanceCount'>;
interface EntryLite { id: string; contentTitle: string; score?: number | null; eliminated?: boolean }

const props = defineProps<{
  slug: string;
  reviewStages: ReviewStage[];
}>();
const emit = defineEmits<{ advanced: [] }>();

const toast = useToast();
const { extract: extractError } = useApiError();

const { data: entriesData, refresh: refreshEntries } = useLazyFetch<{ items: EntryLite[] }>(
  () => `/api/contests/${props.slug}/entries`,
);
const eligibleEntries = computed(() => (entriesData.value?.items ?? []).filter((e) => !e.eliminated));

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

async function advanceStage(stageId: string): Promise<void> {
  const topN = advanceN.value[stageId];
  if (!topN || topN < 1) { toast.error('Enter how many entries advance.'); return; }
  if (!confirm(`Advance the top ${topN} entries from this stage? Entries below the cut are marked "not advanced" and drop out of later judging + final results. You can re-run this.`)) return;
  await postAdvance(stageId, { reviewStageId: stageId, mode: 'topN', topN });
}

async function advanceStageManual(stageId: string): Promise<void> {
  const ids = manualPick.value[stageId] ?? [];
  if (!ids.length) { toast.error('Select at least one entry to advance.'); return; }
  if (!confirm(`Advance the ${ids.length} selected ${ids.length === 1 ? 'entry' : 'entries'}? The rest of the cohort is marked "not advanced" and drops out of later judging + final results.`)) return;
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
    <p class="cpub-form-hint">After judging a review stage, advance the top entries to the next stage. Entries below the cut are marked "not advanced". Re-running re-computes the cut. (Save any stage changes above first.)</p>
    <div v-for="rs in reviewStages" :key="rs.id" class="cpub-advance-block">
      <div class="cpub-advance-row">
        <span class="cpub-advance-name"><i class="fa-solid fa-gavel"></i> {{ rs.name }}</span>
        <div class="cpub-advance-mode">
          <label class="cpub-form-check"><input type="radio" :name="`mode-${rs.id}`" :checked="(advanceMode[rs.id] ?? 'topN') === 'topN'" @change="advanceMode[rs.id] = 'topN'" /> <span>Top N</span></label>
          <label class="cpub-form-check"><input type="radio" :name="`mode-${rs.id}`" :checked="advanceMode[rs.id] === 'manual'" @change="advanceMode[rs.id] = 'manual'" /> <span>Pick manually</span></label>
        </div>
      </div>
      <div v-if="(advanceMode[rs.id] ?? 'topN') === 'topN'" class="cpub-advance-ctl">
        <label class="cpub-form-label" :for="`adv-${rs.id}`">Advance top</label>
        <input :id="`adv-${rs.id}`" v-model.number="advanceN[rs.id]" type="number" min="1" class="cpub-form-input cpub-advance-n" placeholder="50" />
        <button type="button" class="cpub-btn cpub-btn-sm" :disabled="advancing === rs.id" @click="advanceStage(rs.id)">
          <i class="fa-solid fa-arrow-up-right-dots"></i> {{ advancing === rs.id ? 'Advancing…' : 'Advance' }}
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
          <button type="button" class="cpub-btn cpub-btn-sm" :disabled="advancing === rs.id || !(manualPick[rs.id] ?? []).length" @click="advanceStageManual(rs.id)">
            <i class="fa-solid fa-arrow-up-right-dots"></i> {{ advancing === rs.id ? 'Advancing…' : `Advance ${(manualPick[rs.id] ?? []).length} selected` }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Form-control + advancement styles travel with the markup (scoped CSS is per
   component; the global theme only ships .cpub-form-label/-hint/-btn). */
.cpub-form-input { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
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
</style>
