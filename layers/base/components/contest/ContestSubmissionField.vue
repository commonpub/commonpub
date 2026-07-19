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

// File (P6): the model holds a `files.id`; the bytes upload to the PRIVATE `contest`
// purpose (P0). We keep a display name locally (the id alone can't reconstruct it on
// edit — then we show a generic "View file" via the gated /raw route).
// Uploads require the contestPrivateFiles flag (the upload route enforces it too); if
// an operator disabled the feature while a saved template still has a file field, we
// show a clear "unavailable" note rather than letting the upload fail confusingly.
const { features } = useFeatures();
const filesEnabled = computed(() => features.value.contestPrivateFiles === true);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadedName = ref('');
const uploading = ref(false);
const uploadError = ref('');
async function onFilePick(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  uploadError.value = '';
  try {
    // Lazily obtained so non-file fields don't force every consumer to provide it.
    const { uploadFile } = useFileUpload();
    const res = await uploadFile<{ id: string; url: string; originalName: string }>(file, 'contest');
    model.value = res.id;
    uploadedName.value = res.originalName || file.name;
  } catch {
    uploadError.value = 'Upload failed. Please try again.';
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}
function clearFile(): void {
  model.value = '';
  uploadedName.value = '';
}
</script>

<template>
  <div class="cpub-subfield" :class="{ 'cpub-subfield--section': field.type === 'section' }">
    <!-- Section: a display-only header/divider (title + optional description). No input. -->
    <template v-if="field.type === 'section'">
      <!-- A form-group divider, not a document heading — a plain styled element
           avoids an unpredictable heading-level jump in the surrounding outline. -->
      <div class="cpub-subfield-section-title">{{ field.label }}</div>
      <p v-if="field.help" class="cpub-subfield-section-desc">{{ field.help }}</p>
    </template>

    <!-- Agreement: terms to read + an explicit accept checkbox. -->
    <template v-else-if="field.type === 'agreement'">
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

    <!-- Radio: a single choice from options, rendered as a radio group. -->
    <template v-else-if="field.type === 'radio'">
      <span :id="fieldId" class="cpub-subfield-label">
        {{ field.label }} <span v-if="field.required" class="cpub-subfield-req" aria-hidden="true">*</span>
      </span>
      <div class="cpub-subfield-radios" role="radiogroup" :aria-labelledby="fieldId" :aria-describedby="helpId">
        <label v-for="o in (field.options ?? [])" :key="o.value" class="cpub-subfield-radio">
          <input
            type="radio"
            :name="fieldId"
            :value="o.value"
            :checked="model === o.value"
            @change="model = o.value"
          />
          <span>{{ o.label }}</span>
        </label>
      </div>
    </template>

    <!-- File: upload to PRIVATE contest storage; the model holds the file id. -->
    <template v-else-if="field.type === 'file'">
      <span :id="fieldId" class="cpub-subfield-label">
        {{ field.label }} <span v-if="field.required" class="cpub-subfield-req" aria-hidden="true">*</span>
      </span>
      <input
        ref="fileInput"
        type="file"
        class="cpub-sr-only"
        :accept="field.accept || undefined"
        :aria-label="field.label"
        :aria-describedby="helpId"
        @change="onFilePick"
      />
      <div class="cpub-subfield-file">
        <span v-if="model" class="cpub-subfield-file-chip">
          <i class="fa-solid fa-paperclip" aria-hidden="true"></i>
          <a :href="`/api/files/${model}/raw`" target="_blank" rel="noopener noreferrer">{{ uploadedName || 'View uploaded file' }}</a>
          <button type="button" class="cpub-subfield-file-x" aria-label="Remove file" @click="clearFile"><i class="fa-solid fa-xmark"></i></button>
        </span>
        <button v-else-if="filesEnabled" type="button" class="cpub-subfield-file-btn" :disabled="uploading" @click="fileInput?.click()">
          <i class="fa-solid fa-upload" aria-hidden="true"></i> {{ uploading ? 'Uploading…' : 'Choose file' }}
        </button>
        <span v-else class="cpub-subfield-file-off">File uploads are currently unavailable.</span>
      </div>
      <p v-if="uploadError" class="cpub-subfield-file-err" role="alert">{{ uploadError }}</p>
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
        :maxlength="field.maxLength ?? 4000"
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
        :type="field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'tel' ? 'tel' : 'text'"
        class="cpub-subfield-input"
        :class="{ 'cpub-subfield-signature': field.type === 'signature' }"
        :maxlength="field.maxLength ?? 4000"
        :placeholder="field.type === 'url' ? 'https://' : field.type === 'signature' ? 'Type your full name to sign' : undefined"
        :inputmode="field.type === 'tel' ? 'tel' : undefined"
        :aria-describedby="helpId"
      />
    </template>

    <p v-if="field.help && field.type !== 'section'" :id="helpId" class="cpub-subfield-help">{{ field.help }}</p>
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
/* Section: a display-only header/divider between field groups. */
.cpub-subfield--section { margin-top: var(--space-4); gap: 2px; }
.cpub-subfield-section-title { margin: 0; font-size: var(--text-base); font-weight: 700; color: var(--text); border-bottom: var(--border-width-default) solid var(--border2); padding-bottom: var(--space-2); }
.cpub-subfield-section-desc { margin: 0; font-size: var(--text-sm); color: var(--text-dim); line-height: 1.5; }
/* Radio group. */
.cpub-subfield-radios { display: flex; flex-direction: column; gap: 6px; }
.cpub-subfield-radio { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--text); cursor: pointer; }
.cpub-subfield-radio input { width: 15px; height: 15px; flex-shrink: 0; margin: 0; }
/* File upload. */
.cpub-subfield-file { display: flex; align-items: center; gap: 8px; }
.cpub-subfield-file-btn { display: inline-flex; align-items: center; gap: 6px; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); cursor: pointer; }
.cpub-subfield-file-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-subfield-file-btn:disabled { opacity: .6; cursor: progress; }
.cpub-subfield-file-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border: var(--border-width-default) solid var(--border2); background: var(--surface2); font-size: var(--text-sm); max-width: 100%; }
.cpub-subfield-file-chip a { color: var(--accent); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-subfield-file-chip a:hover { text-decoration: underline; }
.cpub-subfield-file-x { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; }
.cpub-subfield-file-x:hover { color: var(--red-text); }
.cpub-subfield-file-err { font-size: 11px; color: var(--red-text); margin: 2px 0 0; }
.cpub-subfield-file-off { font-size: var(--text-sm); color: var(--text-dim); font-style: italic; }
/* Signature: a cursive signing line. */
.cpub-subfield-signature { font-family: cursive, var(--font-sans); font-size: var(--text-base); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
