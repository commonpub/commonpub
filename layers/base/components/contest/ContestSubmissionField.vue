<script setup lang="ts">
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { ADDRESS_SUBFIELDS, parseAddress, serializeAddress, isChecked } from '../../utils/contestSubmission';

// One entrant-facing control for a submission-template field. Renders the right
// input for the field type (text/textarea/url/email/number/select/checkbox/date/
// agreement/address). The model is always a string (the wire shape): checkbox/
// agreement use 'true'/''; address is JSON-encoded. Reused by the per-stage
// artifact form AND the proposal form, so both surfaces behave identically.

const props = withDefaults(defineProps<{
  field: ContestSubmissionTemplateField;
  /** Unique id prefix so multiple forms on a page don't collide. */
  idPrefix?: string;
}>(), { idPrefix: 'cpub-subfield' });

const model = defineModel<string>({ default: '' });

const fieldId = computed(() => `${props.idPrefix}-${props.field.key}`);
const helpId = computed(() => (props.field.help ? `${fieldId.value}-help` : undefined));

// Address: a parsed view-model re-serialized back into the string model on edit.
const address = computed(() => parseAddress(model.value));
function setAddressPart(key: string, value: string): void {
  model.value = serializeAddress({ ...address.value, [key]: value });
}

const checked = computed(() => isChecked(model.value));
function setChecked(on: boolean): void {
  model.value = on ? 'true' : '';
}
</script>

<template>
  <div class="cpub-subfield">
    <!-- Agreement: terms to read + an explicit accept checkbox. -->
    <template v-if="field.type === 'agreement'">
      <span :id="fieldId" class="cpub-subfield-label">
        {{ field.label }} <span v-if="field.required || field.mustAccept !== false" class="cpub-subfield-req" aria-hidden="true">*</span>
      </span>
      <div v-if="field.terms" class="cpub-subfield-terms">{{ field.terms }}</div>
      <label class="cpub-subfield-check">
        <input
          type="checkbox"
          :checked="checked"
          :aria-describedby="helpId"
          @change="setChecked(($event.target as HTMLInputElement).checked)"
        />
        <span>I accept{{ field.required || field.mustAccept !== false ? ' (required)' : '' }}</span>
      </label>
    </template>

    <!-- Checkbox: a single boolean consent / opt-in. -->
    <template v-else-if="field.type === 'checkbox'">
      <label class="cpub-subfield-check">
        <input
          :id="fieldId"
          type="checkbox"
          :checked="checked"
          :aria-describedby="helpId"
          @change="setChecked(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ field.label }} <span v-if="field.required" class="cpub-subfield-req" aria-hidden="true">*</span></span>
      </label>
    </template>

    <!-- Address: structured subfields, JSON-encoded into the model. -->
    <template v-else-if="field.type === 'address'">
      <span :id="fieldId" class="cpub-subfield-label">
        {{ field.label }} <span v-if="field.required" class="cpub-subfield-req" aria-hidden="true">*</span>
      </span>
      <div class="cpub-subfield-address" role="group" :aria-labelledby="fieldId">
        <input
          v-for="sub in ADDRESS_SUBFIELDS"
          :key="sub.key"
          :value="address[sub.key] ?? ''"
          type="text"
          class="cpub-subfield-input"
          :placeholder="sub.label"
          :aria-label="`${field.label}: ${sub.label}`"
          @input="setAddressPart(sub.key, ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- Everything else: a labelled single control. -->
    <template v-else>
      <label class="cpub-subfield-label" :for="fieldId">
        {{ field.label }} <span v-if="field.required" class="cpub-subfield-req" aria-hidden="true">*</span>
        <span v-if="field.required" class="cpub-sr-only">(required)</span>
      </label>
      <textarea
        v-if="field.type === 'textarea'"
        :id="fieldId"
        v-model="model"
        class="cpub-subfield-input cpub-subfield-textarea"
        rows="4"
        maxlength="4000"
        :aria-describedby="helpId"
      ></textarea>
      <select
        v-else-if="field.type === 'select'"
        :id="fieldId"
        v-model="model"
        class="cpub-subfield-input"
        :aria-describedby="helpId"
      >
        <option value="" disabled>Choose…</option>
        <option v-for="o in (field.options ?? [])" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-else
        :id="fieldId"
        v-model="model"
        :type="field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
        class="cpub-subfield-input"
        maxlength="4000"
        :placeholder="field.type === 'url' ? 'https://' : undefined"
        :aria-describedby="helpId"
      />
    </template>

    <p v-if="field.help" :id="helpId" class="cpub-subfield-help">{{ field.help }}</p>
  </div>
</template>

<style scoped>
.cpub-subfield { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.cpub-subfield-label { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); }
.cpub-subfield-req { color: var(--red-text); }
.cpub-subfield-input { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-subfield-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-subfield-textarea { resize: vertical; }
.cpub-subfield-help { font-size: 11px; color: var(--text-faint); margin: 0; }
.cpub-subfield-terms { max-height: 160px; overflow-y: auto; white-space: pre-wrap; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border2); background: var(--surface2); color: var(--text-dim); font-size: var(--text-sm); line-height: 1.6; }
.cpub-subfield-check { display: flex; align-items: flex-start; gap: 8px; font-size: var(--text-sm); color: var(--text); cursor: pointer; }
.cpub-subfield-check input { margin-top: 3px; width: 15px; height: 15px; flex-shrink: 0; }
.cpub-subfield-address { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.cpub-subfield-address .cpub-subfield-input:first-child, .cpub-subfield-address .cpub-subfield-input:nth-child(2) { grid-column: 1 / -1; }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
