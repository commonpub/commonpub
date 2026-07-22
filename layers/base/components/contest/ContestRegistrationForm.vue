<script setup lang="ts">
import { reactive, computed, watch } from 'vue';
import type { FormField } from '@commonpub/schema';
import { blockingFieldKeys, buildSubmissionPayload } from '../../utils/contestSubmission';

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
  /**
   * Editor↔preview link (preview only): the field index highlighted here. Clicking
   * a preview field emits `field-activate` so the paired editor focuses that card.
   * Ignored outside preview, so the real participant form is unaffected.
   */
  activeIndex?: number;
}>(), { savedFields: null, registering: false, preview: false, idPrefix: 'cpub-reg', saveLabel: 'Save details', activeIndex: -1 });

const emit = defineEmits<{
  (e: 'save', fields: Record<string, string>): void;
  /** A preview field was clicked — focus its editor card (preview only). */
  (e: 'field-activate', index: number): void;
}>();

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

// Required-and-missing field keys (drive inline hints + block Save). Reuses the
// shared entry-side `blockingFieldKeys` (isRequiredFormField + isFieldFilled) so the
// registration gate can't diverge from the entry gate or the server's enforcement.
const missing = computed<Set<string>>(() => new Set(blockingFieldKeys(props.template, values)));

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
      <div
        v-for="(f, fi) in template"
        :key="f.key"
        class="cpub-regform-field"
        :class="{
          'cpub-regform-field--invalid': missing.has(f.key),
          'cpub-regform-field--linkable': preview,
          'cpub-regform-field--active': preview && fi === activeIndex,
        }"
        :title="preview ? 'Edit this field in the builder' : undefined"
        @click="preview && emit('field-activate', fi)"
      >
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
/* Preview↔editor link: each preview field is a click target that focuses its
   editor card. Mouse convenience only — the editor is the keyboard source of
   truth, so no extra tab stops are added here. */
.cpub-regform-field--linkable { cursor: pointer; padding: 6px 8px; margin: 0 -8px; border: var(--border-width-default) solid transparent; }
/* The preview fields are disabled (read-only); dropping pointer-events on their
   contents lets a click anywhere in the field reach the wrapper's jump handler,
   not get swallowed by a disabled input that never bubbles a click. */
.cpub-regform-field--linkable :deep(*) { pointer-events: none; }
.cpub-regform-field--linkable:hover { background: var(--surface2); border-color: var(--border2); }
.cpub-regform-field--active { background: var(--accent-bg); border-color: var(--accent) !important; }
.cpub-regform-missing { font-size: 11px; color: var(--red-text); margin: -6px 0 4px; }
.cpub-regform-save { width: 100%; justify-content: center; margin-top: var(--space-2); }
</style>
