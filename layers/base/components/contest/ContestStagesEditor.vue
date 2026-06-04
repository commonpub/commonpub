<script setup lang="ts">
import type { ContestStage } from '@commonpub/schema';

// Phase B1 — define an arbitrary, ordered stage timeline for a contest. Empty ⇒
// the contest uses the synthesized standard flow (Submissions → Judging → Results),
// so this editor is opt-in. `kind` drives display + how the stage maps to the coarse
// status; `name`/dates are arbitrary. Used by both create.vue and edit.vue.

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

const KINDS: ContestStage['kind'][] = ['submission', 'review', 'interim', 'results', 'event', 'custom'];

// datetime-local <-> ISO (mirrors the rest of the contest forms' convention).
function toLocal(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toISOString().slice(0, 16); } catch { return ''; }
}
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function commit(next: ContestStage[]): void {
  stages.value = next;
}

function setField(i: number, patch: Partial<ContestStage>): void {
  const next = stages.value.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
  commit(next);
}

function onDate(i: number, field: 'startsAt' | 'endsAt', e: Event): void {
  const v = toIso((e.target as HTMLInputElement).value);
  setField(i, { [field]: v } as Partial<ContestStage>);
}

// Array operations live as pure functions in utils/contestStages.ts (unit-tested).
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
        <li v-for="(stage, i) in stages" :key="stage.id" class="cpub-stage-row">
          <div class="cpub-stage-row-head">
            <span class="cpub-stage-num">{{ i + 1 }}</span>
            <label class="cpub-stage-current" :title="currentId === stage.id ? 'This is the current stage' : 'Mark as the current stage'">
              <input
                type="radio"
                name="cpub-current-stage"
                :checked="currentId === stage.id"
                @change="currentId = stage.id"
              />
              <span>Current</span>
            </label>
            <div class="cpub-stage-row-actions">
              <button type="button" class="cpub-stage-iconbtn" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)"><i class="fa-solid fa-arrow-up"></i></button>
              <button type="button" class="cpub-stage-iconbtn" :disabled="i === stages.length - 1" aria-label="Move down" @click="move(i, 1)"><i class="fa-solid fa-arrow-down"></i></button>
              <button type="button" class="cpub-stage-iconbtn" aria-label="Duplicate stage" @click="duplicateStage(i)"><i class="fa-solid fa-clone"></i></button>
              <button type="button" class="cpub-stage-iconbtn cpub-stage-del" aria-label="Remove stage" @click="removeStage(i)"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>

          <div class="cpub-form-row">
            <div class="cpub-form-field" style="flex: 2;">
              <label class="cpub-form-label">Stage name</label>
              <input
                :value="stage.name"
                type="text"
                class="cpub-form-input"
                placeholder="e.g. Proposals Open"
                @input="setField(i, { name: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="cpub-form-field" style="flex: 1;">
              <label class="cpub-form-label">Type</label>
              <select
                :value="stage.kind"
                class="cpub-form-input"
                @change="setField(i, { kind: ($event.target as HTMLSelectElement).value as ContestStage['kind'] })"
              >
                <option v-for="k in KINDS" :key="k" :value="k">{{ STAGE_KIND_LABEL[k] }}</option>
              </select>
            </div>
          </div>

          <div class="cpub-form-row">
            <div class="cpub-form-field">
              <label class="cpub-form-label">Starts</label>
              <input type="datetime-local" class="cpub-form-input" :value="toLocal(stage.startsAt)" @input="onDate(i, 'startsAt', $event)" />
            </div>
            <div class="cpub-form-field">
              <label class="cpub-form-label">Ends (countdown target)</label>
              <input type="datetime-local" class="cpub-form-input" :value="toLocal(stage.endsAt)" @input="onDate(i, 'endsAt', $event)" />
            </div>
          </div>

          <div class="cpub-form-field">
            <label class="cpub-form-label">Description (optional)</label>
            <input
              :value="stage.description ?? ''"
              type="text"
              class="cpub-form-input"
              placeholder="What happens — or what to submit/refine — this stage"
              @input="setField(i, { description: ($event.target as HTMLInputElement).value || undefined })"
            />
          </div>

          <div v-if="stage.kind === 'event'" class="cpub-form-row">
            <div class="cpub-form-field">
              <label class="cpub-form-label">Location</label>
              <input :value="stage.location ?? ''" type="text" class="cpub-form-input" placeholder="e.g. Washington, D.C." @input="setField(i, { location: ($event.target as HTMLInputElement).value || undefined })" />
            </div>
            <div class="cpub-form-field">
              <label class="cpub-form-label">Link</label>
              <input :value="stage.url ?? ''" type="url" class="cpub-form-input" placeholder="https://…" @input="setField(i, { url: ($event.target as HTMLInputElement).value || undefined })" />
            </div>
          </div>
        </li>
      </ol>

      <div class="cpub-stage-toolbar">
        <button type="button" class="cpub-btn cpub-btn-sm" @click="addStage"><i class="fa-solid fa-plus"></i> Add stage</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Self-contained form-control styles (tokenised) — Vue scoped CSS doesn't cross
   component boundaries, so this extracted editor styles its own inputs rather than
   relying on the parent page. Mirrors the contest pages' controls. */
.cpub-form-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-input, .cpub-form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-textarea { resize: vertical; }
.cpub-form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); }

.cpub-stages-standard { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.cpub-stage-tophead { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.cpub-stage-count { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); }
.cpub-stage-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
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
.cpub-stage-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.cpub-stage-reset { color: var(--text-faint); }
</style>
