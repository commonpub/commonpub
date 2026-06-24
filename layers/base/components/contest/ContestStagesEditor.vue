<script setup lang="ts">
import type { ContestStage } from '@commonpub/schema';
import ContestStageCard from './ContestStageCard.vue';

// Phase B1 — define an arbitrary, ordered stage timeline for a contest. Empty ⇒
// the contest uses the synthesized standard flow (Submissions → Judging → Results),
// so this editor is opt-in. `kind` drives display + how the stage maps to the coarse
// status; `name`/dates are arbitrary. Used by both create.vue and edit.vue.
//
// This component is the LIST orchestrator: it owns the stages array + the
// add/move/remove/duplicate/reset operations (pure helpers in utils/contestStages.ts)
// and renders one ContestStageCard per stage, applying the card's emitted intents.

const stages = defineModel<ContestStage[]>({ required: true });
// Local name `currentId` avoids colliding with the auto-imported `currentStageId`
// util (the model name string stays `currentStageId` for the parent v-model).
const currentId = defineModel<string | null>('currentStageId', { default: null });

const props = defineProps<{
  // Contest dates — used to seed the synthesized stages when the owner customizes.
  startDate: string;
  endDate: string;
  judgingEndDate?: string | null;
}>();

// Whole-array reassign on every edit (pure ops); keeps the parent v-model reactive.
function commit(next: ContestStage[]): void {
  stages.value = next;
}

function setField(i: number, patch: Partial<ContestStage>): void {
  commit(stages.value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
}

// Stage-array operations live as pure functions in utils/contestStages.ts (unit-tested).
function addStage(): void {
  commit(withStageAdded(stages.value));
}
function duplicateStage(i: number): void {
  commit(withStageDuplicated(stages.value, i));
}
function removeStage(i: number): void {
  const removed = stages.value[i];
  commit(withStageRemoved(stages.value, i));
  if (removed && currentId.value === removed.id) currentId.value = null;
}
function move(i: number, dir: -1 | 1): void {
  commit(withStageMoved(stages.value, i, dir));
}

// Seed the editor with the standard three stages so the owner has a starting point.
function customize(): void {
  commit(seedStandardStages(props));
}
function resetToStandard(): void {
  currentId.value = null;
  commit([]);
}

const missingSubmission = computed(() => stages.value.length > 0 && !stages.value.some((s) => s.kind === 'submission'));
</script>

<template>
  <div class="cpub-stages-editor">
    <!-- Empty state: standard flow -->
    <div v-if="!stages.length" class="cpub-stages-standard">
      <p class="cpub-form-hint" style="margin: 0;">
        This contest uses the <strong>standard flow</strong>: Submissions → Judging → Results, driven by
        the schedule dates above. Customize only if you need extra rounds (e.g. a proposal round, a
        Top-N selection, a build sprint, multiple judging rounds, or a showcase event).
      </p>
      <button type="button" class="cpub-btn cpub-btn-sm" @click="customize">
        <i class="fa-solid fa-diagram-project"></i> Customize stages
      </button>
    </div>

    <template v-else>
      <div class="cpub-stage-tophead">
        <span class="cpub-stage-count">{{ stages.length }} stage{{ stages.length === 1 ? '' : 's' }}</span>
        <div class="cpub-stage-toolbar">
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addStage"><i class="fa-solid fa-plus"></i> Add stage</button>
          <button type="button" class="cpub-btn cpub-btn-sm cpub-stage-reset" @click="resetToStandard"><i class="fa-solid fa-rotate-left"></i> Reset to standard</button>
        </div>
      </div>
      <p v-if="missingSubmission" class="cpub-form-error" role="alert" style="margin: 0 0 10px;">
        Add at least one <strong>Submissions</strong> stage, or reset to the standard flow.
      </p>

      <ol class="cpub-stage-list">
        <ContestStageCard
          v-for="(stage, i) in stages"
          :key="stage.id"
          :stage="stage"
          :index="i"
          :is-current="currentId === stage.id"
          :is-first="i === 0"
          :is-last="i === stages.length - 1"
          @patch="setField(i, $event)"
          @move="move(i, $event)"
          @duplicate="duplicateStage(i)"
          @remove="removeStage(i)"
          @set-current="currentId = stage.id"
        />
      </ol>

      <div class="cpub-stage-toolbar">
        <button type="button" class="cpub-btn cpub-btn-sm" @click="addStage"><i class="fa-solid fa-plus"></i> Add stage</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Only the list/orchestrator chrome lives here; the per-stage form controls travel
   with ContestStageCard / ContestStageTemplateEditor (scoped CSS is per-component). */
.cpub-stages-standard { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.cpub-stage-tophead { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.cpub-stage-count { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); }
.cpub-stage-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.cpub-stage-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.cpub-stage-reset { color: var(--text-faint); }
</style>
