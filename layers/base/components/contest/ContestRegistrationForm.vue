<script setup lang="ts">
import { reactive, computed, watch } from 'vue';
import type { FormField } from '@commonpub/schema';
import { isFieldFilled, buildSubmissionPayload } from '../../utils/contestSubmission';

// Template-driven registration form. Renders the operator's `registrationTemplate`
// (or the default legacy 3 fields) through the shared ContestSubmissionField, so
// the registration form behaves identically to entry submissions. Collects a
// Record<string,string> of answers; the server validates + partitions them
// (public / PII / consent). Dirty-tracked so Save is only enabled when something
// changed. `preview` renders it read-only (reused as the editor's live preview).

const props = withDefaults(defineProps<{
  template: FormField[];
  /** Viewer's saved answers (prefill). */
  savedFields?: Record<string, string> | null;
  /** In-flight request (disables Save). */
  registering?: boolean;
  /** Read-only render (no Save, inputs disabled) — the editor live preview. */
  preview?: boolean;
  idPrefix?: string;
  /** Save button label. */
  saveLabel?: string;
}>(), { savedFields: null, registering: false, preview: false, idPrefix: 'cpub-reg', saveLabel: 'Save details' });

const emit = defineEmits<{ (e: 'save', fields: Record<string, string>): void }>();

// Live answer model, keyed by field key. Section fields carry no value.
const values = reactive<Record<string, string>>({});

function seed(saved: Record<string, string> | null): void {
  for (const k of Object.keys(values)) delete values[k];
  for (const f of props.template) {
    if (f.type === 'section') continue;
    values[f.key] = saved?.[f.key] ?? '';
  }
}
watch(() => [props.savedFields, props.template] as const, () => seed(props.savedFields), { immediate: true, deep: true });

// A field is required-and-missing (drives inline hints + blocks Save). Reuses the
// shared, server-mirroring `isFieldFilled` (agreements/checkbox via isChecked,
// address via parseAddress, section always filled) so this can't diverge from the
// entry-side gate. Agreements are required when `required` OR `mustAccept !== false`.
const missing = computed<Set<string>>(() => {
  const out = new Set<string>();
  for (const f of props.template) {
    const mustAccept = f.type === 'agreement' && f.mustAccept !== false;
    if ((f.required || mustAccept) && !isFieldFilled(f, values[f.key])) out.add(f.key);
  }
  return out;
});

// Collected payload — the shared builder (trims, normalizes checkbox/agreement,
// drops blanks + section) so it matches the entry form + the server contract.
const collected = computed<Record<string, string>>(() => buildSubmissionPayload(props.template, values));

// Dirty = collected differs from saved (so Save is meaningful).
const dirty = computed<boolean>(() => {
  const saved = props.savedFields ?? {};
  const keys = new Set([...Object.keys(collected.value), ...Object.keys(saved)]);
  for (const k of keys) if ((collected.value[k] ?? '') !== (saved[k] ?? '')) return true;
  return false;
});

const canSave = computed(() => dirty.value && missing.value.size === 0 && !props.registering);

function save(): void {
  if (!canSave.value) return;
  emit('save', collected.value);
}
</script>

<template>
  <div class="cpub-regform">
    <fieldset class="cpub-regform-fields" :disabled="preview">
      <div v-for="f in template" :key="f.key" class="cpub-regform-field" :class="{ 'cpub-regform-field--invalid': missing.has(f.key) }">
        <ContestSubmissionField :field="f" :id-prefix="idPrefix" v-model="values[f.key]" />
        <p v-if="missing.has(f.key)" class="cpub-regform-missing" role="alert">This field is required.</p>
      </div>
    </fieldset>

    <button
      v-if="!preview"
      type="button"
      class="cpub-btn cpub-btn-primary cpub-regform-save"
      :disabled="!canSave"
      @click="save"
    >
      <i class="fa-solid fa-floppy-disk"></i>
      {{ registering ? 'Saving…' : saveLabel }}
    </button>
  </div>
</template>

<style scoped>
.cpub-regform { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-regform-fields { border: none; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; }
.cpub-regform-field--invalid :deep(.cpub-subfield-input) { border-color: var(--red-border); }
.cpub-regform-missing { font-size: 11px; color: var(--red-text); margin: -6px 0 4px; }
.cpub-regform-save { width: 100%; justify-content: center; margin-top: var(--space-2); }
</style>
