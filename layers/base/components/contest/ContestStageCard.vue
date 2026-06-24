<script setup lang="ts">
/**
 * ContestStageCard — one stage row in the ContestStagesEditor list, extracted so
 * the orchestrator stays a thin list + toolbar. Presentational + intent-emitting:
 * it renders one stage's fields and emits granular changes (`patch`, `move`,
 * `duplicate`, `remove`, `set-current`); the parent applies them with the pure
 * array ops in utils/contestStages.ts. Flag-gated extras (submission mode, the
 * submission-form builder) re-derive `useFeatures()` here rather than prop-drilling.
 */
import type { ContestStage } from '@commonpub/schema';
import ContestStageTemplateEditor from './ContestStageTemplateEditor.vue';

const props = defineProps<{
  stage: ContestStage;
  index: number;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{
  patch: [patch: Partial<ContestStage>];
  move: [dir: -1 | 1];
  duplicate: [];
  remove: [];
  'set-current': [];
}>();

const KINDS: ContestStage['kind'][] = ['submission', 'review', 'interim', 'results', 'event', 'custom'];

const { features } = useFeatures();
const templatesEnabled = computed(() => features.value.contestStageSubmissions !== false);
const proposalsEnabled = computed(() => features.value.contestProposals === true);

function setField(patch: Partial<ContestStage>): void {
  emit('patch', patch);
}
function advanceCountInput(e: Event): void {
  const v = (e.target as HTMLInputElement).value;
  setField({ advanceCount: v === '' ? undefined : Math.max(1, Math.round(Number(v))) });
}
// The template editor hands back the whole field array; mirror the stored shape
// (empty → undefined) so a cleared form drops the key entirely.
function onTemplateUpdate(template: ContestStage['submissionTemplate']): void {
  setField({ submissionTemplate: template && template.length ? template : undefined });
}
</script>

<template>
  <li class="cpub-stage-row">
    <div class="cpub-stage-row-head">
      <span class="cpub-stage-num">{{ index + 1 }}</span>
      <label class="cpub-stage-current" :title="isCurrent ? 'This is the current stage' : 'Mark as the current stage'">
        <input
          type="radio"
          name="cpub-current-stage"
          :checked="isCurrent"
          @change="emit('set-current')"
        />
        <span>Current</span>
      </label>
      <div class="cpub-stage-row-actions">
        <button type="button" class="cpub-stage-iconbtn" :disabled="isFirst" aria-label="Move up" @click="emit('move', -1)"><i class="fa-solid fa-arrow-up"></i></button>
        <button type="button" class="cpub-stage-iconbtn" :disabled="isLast" aria-label="Move down" @click="emit('move', 1)"><i class="fa-solid fa-arrow-down"></i></button>
        <button type="button" class="cpub-stage-iconbtn" aria-label="Duplicate stage" @click="emit('duplicate')"><i class="fa-solid fa-clone"></i></button>
        <button type="button" class="cpub-stage-iconbtn cpub-stage-del" aria-label="Remove stage" @click="emit('remove')"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>

    <div class="cpub-form-row">
      <div class="cpub-form-field" style="flex: 2;">
        <label :for="`stage-name-${index}`" class="cpub-form-label">Stage name</label>
        <input
          :id="`stage-name-${index}`"
          :value="stage.name"
          type="text"
          class="cpub-form-input"
          placeholder="e.g. Proposals Open"
          @input="setField({ name: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="cpub-form-field" style="flex: 1;">
        <label :for="`stage-type-${index}`" class="cpub-form-label">Type</label>
        <select
          :id="`stage-type-${index}`"
          :value="stage.kind"
          class="cpub-form-input"
          @change="setField({ kind: ($event.target as HTMLSelectElement).value as ContestStage['kind'] })"
        >
          <option v-for="k in KINDS" :key="k" :value="k">{{ STAGE_KIND_LABEL[k] }}</option>
        </select>
      </div>
    </div>

    <p class="cpub-stage-kind-help"><i class="fa-solid fa-circle-info"></i> {{ STAGE_KIND_HELP[stage.kind] }}</p>

    <div class="cpub-form-row">
      <CpubDateTimeField
        label="Starts"
        :model-value="stage.startsAt"
        :max="stage.endsAt"
        @update:model-value="setField({ startsAt: $event })"
      />
      <CpubDateTimeField
        label="Ends (countdown target)"
        :model-value="stage.endsAt"
        :min="stage.startsAt"
        @update:model-value="setField({ endsAt: $event })"
      />
    </div>

    <div class="cpub-form-field">
      <label :for="`stage-desc-${index}`" class="cpub-form-label">Description (optional)</label>
      <input
        :id="`stage-desc-${index}`"
        :value="stage.description ?? ''"
        type="text"
        class="cpub-form-input"
        placeholder="What happens, or what to submit/refine, this stage"
        @input="setField({ description: ($event.target as HTMLInputElement).value || undefined })"
      />
    </div>

    <!-- Per-round config (review stages): how many advance + the rubric -->
    <div v-if="stage.kind === 'review'" class="cpub-stage-criteria">
      <div class="cpub-form-field" style="margin-bottom: 10px;">
        <label :for="`stage-advance-${index}`" class="cpub-form-label">Advance the top N to the next stage</label>
        <input :id="`stage-advance-${index}`" :value="stage.advanceCount ?? ''" type="number" min="1" class="cpub-form-input cpub-stage-advn" placeholder="e.g. 50, leave blank to decide at advance time" @input="advanceCountInput($event)" />
      </div>
      <p class="cpub-form-hint" style="margin: 4px 0;">Optional, leave empty to use the contest’s default criteria. Set per-round criteria for multi-round contests (e.g. judge proposals on Feasibility, prototypes on Deployment readiness).</p>
      <ContestCriteriaEditor
        :model-value="(stage.criteria ?? [])"
        label="Judging criteria, this round"
        :show-total="false"
        @update:model-value="setField({ criteria: ($event as ContestStage['criteria']) })"
      />
    </div>

    <!-- Submission mode (Phase 4): attach an existing project, or collect a
         form-first proposal that seeds a draft placeholder project. -->
    <div v-if="stage.kind === 'submission' && proposalsEnabled" class="cpub-form-field">
      <label :for="`stage-mode-${index}`" class="cpub-form-label">How entrants submit</label>
      <select
        :id="`stage-mode-${index}`"
        :value="stage.submissionMode ?? 'attach'"
        class="cpub-form-input"
        @change="setField({ submissionMode: (($event.target as HTMLSelectElement).value as 'attach' | 'proposal') })"
      >
        <option value="attach">Attach an existing published project</option>
        <option value="proposal">Proposal form (creates a draft project)</option>
      </select>
      <p class="cpub-form-hint" style="margin: 4px 0;">Proposal mode lets entrants apply with just this form. The server creates a draft project they develop for later rounds.</p>
    </div>

    <!-- Per-stage submission template (submission stages): the artifact fields
         entrants fill for THIS stage (proposal vs prototype). -->
    <ContestStageTemplateEditor
      v-if="stage.kind === 'submission' && templatesEnabled"
      :template="stage.submissionTemplate ?? []"
      @update:template="onTemplateUpdate"
    />

    <div v-if="stage.kind === 'event'" class="cpub-form-row">
      <div class="cpub-form-field">
        <label :for="`stage-location-${index}`" class="cpub-form-label">Location</label>
        <input :id="`stage-location-${index}`" :value="stage.location ?? ''" type="text" class="cpub-form-input" placeholder="e.g. Washington, D.C." @input="setField({ location: ($event.target as HTMLInputElement).value || undefined })" />
      </div>
      <div class="cpub-form-field">
        <label :for="`stage-url-${index}`" class="cpub-form-label">Link</label>
        <input :id="`stage-url-${index}`" :value="stage.url ?? ''" type="url" class="cpub-form-input" placeholder="https://…" @input="setField({ url: ($event.target as HTMLInputElement).value || undefined })" />
      </div>
    </div>
  </li>
</template>

<style scoped>
/* Form controls + stage-row styles travel with this extracted markup (scoped CSS
   doesn't cross component boundaries; the global theme only ships
   .cpub-form-label/.cpub-form-hint/.cpub-btn). */
.cpub-form-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-input { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); }

.cpub-stage-row { border: var(--border-width-default) solid var(--border); background: var(--surface2); padding: 12px; }
.cpub-stage-row-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.cpub-stage-num { width: 22px; height: 22px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; font-family: var(--font-mono); background: var(--accent-bg); color: var(--accent); border: var(--border-width-default) solid var(--accent-border); }
.cpub-stage-current { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); cursor: pointer; }
.cpub-stage-current input { width: 13px; height: 13px; }
.cpub-stage-row-actions { margin-left: auto; display: flex; gap: 4px; }
.cpub-stage-iconbtn { background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-dim); cursor: pointer; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
.cpub-stage-iconbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-stage-iconbtn:disabled { opacity: .4; cursor: not-allowed; }
.cpub-stage-del:hover { border-color: var(--red-border); color: var(--red); }
.cpub-stage-kind-help { font-size: 11px; color: var(--text-faint); line-height: 1.5; margin: 0 0 4px; display: flex; gap: 6px; }
.cpub-stage-kind-help i { color: var(--accent); margin-top: 2px; flex-shrink: 0; }
.cpub-stage-criteria { border: var(--border-width-default) dashed var(--border2); padding: 10px; margin-top: 4px; background: var(--surface); }
.cpub-stage-advn { max-width: 320px; }
</style>
