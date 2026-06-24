<script setup lang="ts">
/**
 * ContestStageTemplateEditor — the per-stage SUBMISSION FORM builder, extracted
 * from ContestStagesEditor so the (heaviest, flag-gated) part of the stage card is
 * its own cohesive unit. Operates on ONE stage's `submissionTemplate` array and
 * emits the whole new array (`update:template`); the pure array ops live in
 * utils/contestStages.ts. The agreement/address field types + the per-field PII
 * toggle are gated behind `features.contestPii` (rule #2); PII *access* is always
 * gated server-side by the `contest.pii` permission regardless.
 */
import type { ContestSubmissionTemplateField } from '@commonpub/schema';

const props = defineProps<{
  template: ContestSubmissionTemplateField[];
}>();
const emit = defineEmits<{ 'update:template': [template: ContestSubmissionTemplateField[]] }>();

const { features } = useFeatures();
const piiEnabled = computed(() => features.value.contestPii === true);
const FIELD_TYPES = computed<ContestSubmissionTemplateField['type'][]>(() => {
  const base: ContestSubmissionTemplateField['type'][] = ['text', 'textarea', 'url', 'email', 'number', 'select', 'checkbox', 'date'];
  if (piiEnabled.value) base.push('agreement', 'address');
  return base;
});

function addField(): void {
  emit('update:template', templateFieldAdded(props.template));
}
function labelInput(fi: number, e: Event): void {
  emit('update:template', templateFieldLabelChanged(props.template, fi, (e.target as HTMLInputElement).value));
}
function setField(fi: number, patch: Partial<ContestSubmissionTemplateField>): void {
  emit('update:template', templateFieldSet(props.template, fi, patch));
}
function changeType(fi: number, type: ContestSubmissionTemplateField['type']): void {
  emit('update:template', templateFieldTypeChanged(props.template, fi, type));
}
function removeField(fi: number): void {
  emit('update:template', templateFieldRemoved(props.template, fi));
}
function addOption(fi: number): void {
  emit('update:template', templateOptionAdded(props.template, fi));
}
function setOption(fi: number, oi: number, patch: Partial<{ value: string; label: string }>): void {
  emit('update:template', templateOptionSet(props.template, fi, oi, patch));
}
function removeOption(fi: number, oi: number): void {
  emit('update:template', templateOptionRemoved(props.template, fi, oi));
}
</script>

<template>
  <div class="cpub-stage-criteria">
    <div class="cpub-stage-criteria-head">
      <span class="cpub-form-label" style="margin: 0;">Submission form, this stage</span>
      <button type="button" class="cpub-btn cpub-btn-sm" @click="addField"><i class="fa-solid fa-plus"></i> Add field</button>
    </div>
    <p class="cpub-form-hint" style="margin: 4px 0;">Optional. Add fields entrants must fill for this stage (e.g. a proposal summary, or a repository link for a prototype round). Leave empty if entering a project is enough.</p>
    <div v-for="(tf, fi) in template" :key="fi" class="cpub-stage-tfield">
      <div class="cpub-stage-tfield-main">
        <input
          :value="tf.label"
          type="text"
          class="cpub-form-input"
          placeholder="Field label (e.g. Repository URL)"
          :aria-label="`Field ${fi + 1} label`"
          @input="labelInput(fi, $event)"
        />
        <select
          :value="tf.type"
          class="cpub-form-input cpub-stage-tfield-type"
          :aria-label="`Field ${fi + 1} type`"
          @change="changeType(fi, ($event.target as HTMLSelectElement).value as ContestSubmissionTemplateField['type'])"
        >
          <option v-for="t in FIELD_TYPES" :key="t" :value="t">{{ TEMPLATE_FIELD_TYPE_LABEL[t] }}</option>
        </select>
        <label class="cpub-stage-tfield-req">
          <input
            type="checkbox"
            :checked="tf.required"
            :aria-label="`Field ${fi + 1} required`"
            @change="setField(fi, { required: ($event.target as HTMLInputElement).checked })"
          />
          <span>Required</span>
        </label>
        <button type="button" class="cpub-stage-iconbtn cpub-stage-del" aria-label="Remove field" @click="removeField(fi)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <input
        :value="tf.help ?? ''"
        type="text"
        class="cpub-form-input cpub-stage-tfield-help"
        placeholder="Hint shown under the input (optional)"
        :aria-label="`Field ${fi + 1} hint`"
        @input="setField(fi, { help: ($event.target as HTMLInputElement).value || undefined })"
      />

      <!-- select: the allowed options -->
      <div v-if="tf.type === 'select'" class="cpub-stage-tfield-extra">
        <span class="cpub-form-hint" style="margin: 0;">Choices</span>
        <div v-for="(opt, oi) in (tf.options ?? [])" :key="oi" class="cpub-stage-opt-row">
          <input
            :value="opt.label"
            type="text"
            class="cpub-form-input"
            placeholder="Label (shown to entrants)"
            :aria-label="`Field ${fi + 1} option ${oi + 1} label`"
            @input="setOption(fi, oi, { label: ($event.target as HTMLInputElement).value })"
          />
          <input
            :value="opt.value"
            type="text"
            class="cpub-form-input"
            placeholder="Value (stored)"
            :aria-label="`Field ${fi + 1} option ${oi + 1} value`"
            @input="setOption(fi, oi, { value: ($event.target as HTMLInputElement).value })"
          />
          <button type="button" class="cpub-stage-iconbtn cpub-stage-del" aria-label="Remove option" @click="removeOption(fi, oi)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <button type="button" class="cpub-btn cpub-btn-sm" @click="addOption(fi)"><i class="fa-solid fa-plus"></i> Add choice</button>
      </div>

      <!-- agreement: terms the entrant must accept -->
      <div v-if="tf.type === 'agreement'" class="cpub-stage-tfield-extra">
        <textarea
          :value="tf.terms ?? ''"
          class="cpub-form-input cpub-form-textarea"
          rows="3"
          placeholder="Terms the entrant must accept (e.g. shipping the hardware to winners)"
          :aria-label="`Field ${fi + 1} agreement terms`"
          @input="setField(fi, { terms: ($event.target as HTMLTextAreaElement).value || undefined })"
        ></textarea>
        <label class="cpub-stage-tfield-req">
          <input
            type="checkbox"
            :checked="tf.mustAccept !== false"
            :aria-label="`Field ${fi + 1} must accept`"
            @change="setField(fi, { mustAccept: ($event.target as HTMLInputElement).checked })"
          />
          <span>Must accept to submit</span>
        </label>
      </div>

      <!-- address: structured + always personal data -->
      <p v-if="tf.type === 'address'" class="cpub-form-hint" style="margin: 4px 0;">
        Collected as a structured mailing address and stored as personal data. Visible only to staff with PII access and the entrant.
      </p>

      <!-- PII toggle (non-address, non-agreement scalar fields) -->
      <label
        v-if="piiEnabled && tf.type !== 'address' && tf.type !== 'agreement'"
        class="cpub-stage-tfield-req cpub-stage-tfield-pii"
      >
        <input
          type="checkbox"
          :checked="tf.pii === true"
          :aria-label="`Field ${fi + 1} is personal data`"
          @change="setField(fi, { pii: ($event.target as HTMLInputElement).checked || undefined })"
        />
        <span>Personal data (store privately, hide from the public listing)</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
/* Scoped CSS doesn't cross component boundaries — the form-control + template-field
   styles travel with this extracted markup (the global theme only provides
   .cpub-form-label/.cpub-form-hint/.cpub-btn). */
.cpub-form-input, .cpub-form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-textarea { resize: vertical; }

.cpub-stage-iconbtn { background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-dim); cursor: pointer; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
.cpub-stage-iconbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-stage-del:hover { border-color: var(--red-border); color: var(--red); }

.cpub-stage-criteria { border: var(--border-width-default) dashed var(--border2); padding: 10px; margin-top: 4px; background: var(--surface); }
.cpub-stage-criteria-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cpub-stage-tfield { margin-top: 8px; padding-top: 8px; border-top: var(--border-width-default) dashed var(--border2); }
.cpub-stage-tfield:first-of-type { border-top: 0; padding-top: 0; }
.cpub-stage-tfield-main { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cpub-stage-tfield-main .cpub-form-input { flex: 2; min-width: 140px; margin: 0; }
.cpub-stage-tfield-type { flex: 1 !important; min-width: 110px !important; max-width: 150px; }
.cpub-stage-tfield-req { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); cursor: pointer; flex-shrink: 0; }
.cpub-stage-tfield-req input { width: 13px; height: 13px; }
.cpub-stage-tfield-help { margin-top: 6px !important; font-size: var(--text-xs) !important; }
.cpub-stage-tfield-extra { margin-top: 6px; padding: 8px; border: var(--border-width-default) dashed var(--border2); background: var(--surface2); display: flex; flex-direction: column; gap: 6px; }
.cpub-stage-opt-row { display: flex; align-items: center; gap: 6px; }
.cpub-stage-opt-row .cpub-form-input { flex: 1; min-width: 100px; margin: 0; }
.cpub-stage-tfield-pii { margin-top: 6px; }
</style>
