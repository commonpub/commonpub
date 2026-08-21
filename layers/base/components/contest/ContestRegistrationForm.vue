<script setup lang="ts">
import { reactive, computed, watch, ref, nextTick } from 'vue';
import type { FormField } from '@commonpub/schema';
import { blockingFieldKeys, buildSubmissionPayload, visibleTemplateFields } from '../../utils/contestSubmission';

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
   * Whether the viewer is ALREADY registered (so this is an edit, not a first
   * registration). Drives whether an unchanged form may still be submitted.
   */
  alreadyRegistered?: boolean;
  /**
   * Editor↔preview link (preview only): the field index highlighted here. Clicking
   * a preview field emits `field-activate` so the paired editor focuses that card.
   * Ignored outside preview, so the real participant form is unaffected.
   */
  activeIndex?: number;
}>(), { savedFields: null, registering: false, preview: false, idPrefix: 'cpub-reg', saveLabel: 'Save details', activeIndex: -1, alreadyRegistered: false });

const emit = defineEmits<{
  (e: 'save', fields: Record<string, string>): void;
  /** A preview field was clicked — focus its editor card (preview only). */
  (e: 'field-activate', index: number): void;
}>();

// Live answer model, keyed by field key. Section fields carry no value.
const values = reactive<Record<string, string>>({});

/**
 * Has the participant typed anything? Set by the values watcher below, which
 * ignores our own seeding writes.
 *
 * It gates re-seeding because `savedFields` arrives from a `{ server: false }`
 * fetch — null through SSR and hydration, then a new object when the request
 * lands. The form is interactive that whole time, so a participant who starts
 * typing immediately had every answer deleted out from under them when the
 * response arrived. A late fetch may correct a placeholder; it may not overwrite
 * a person's input.
 */
const userEdited = ref(false);
let seeding = false;

function seed(saved: Record<string, string> | null): void {
  seeding = true;
  for (const k of Object.keys(values)) delete values[k];
  for (const f of props.template) {
    if (f.type === 'section') continue;
    values[f.key] = saved?.[f.key] ?? '';
  }
  seeding = false;
}

// `flush: 'sync'` so the flag is settled before any other watcher observes the
// change; a deferred reset would let a seeding write look like a user edit.
watch(values, () => { if (!seeding) userEdited.value = true; }, { deep: true, flush: 'sync' });

watch(
  () => [props.savedFields, props.template] as const,
  () => { if (!userEdited.value) seed(props.savedFields); },
  { immediate: true, deep: true },
);

// Required-and-missing field keys (drive inline hints + block Save). Reuses the
// shared entry-side `blockingFieldKeys` (isRequiredFormField + isFieldFilled) so the
// registration gate can't diverge from the entry gate or the server's enforcement.
// Conditional display (P7): the fields shown right now, given the answers so far.
// In `preview` the operator wants to see the WHOLE form they are authoring —
// filtering it would hide half the builder's output behind answers the preview
// has no way to give.
const shownFields = computed(() => (props.preview ? props.template : visibleTemplateFields(props.template, values)));

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

/** The label of another field, for the preview's conditional note. */
function labelOfKey(key: string): string {
  return props.template.find((f) => f.key === key)?.label || key;
}
/** A condition's values as the labels the participant would actually see. */
function conditionValueSummary(field: FormField): string {
  const cond = field.showWhen;
  const source = cond ? props.template.find((f) => f.key === cond.field) : undefined;
  if (!cond || !source) return '';
  const labels = cond.equals.map((v) => {
    if (source.type === 'checkbox') return v === 'true' ? 'checked' : 'not checked';
    return source.options?.find((o) => o.value === v)?.label || v;
  });
  return labels.join(' or ');
}

/**
 * Which fields have been interacted with, plus whether the participant has tried
 * to save. Together they decide when an error is SHOWN.
 *
 * Before this, `missing` alone drove the inline error, so a pristine 42-field
 * form rendered 20 "This field is required." messages — each in a `role="alert"`
 * live region — the instant it loaded, on a page seven screens tall. That is a
 * hostile first impression and a WCAG 3.3.1 problem: errors were identified
 * before any input existed to be in error.
 */
const touched = reactive(new Set<string>());
const attempted = ref(false);
function markTouched(key: string): void {
  touched.add(key);
}
/** Show a field's error once the participant has left it, or tried to save. */
function showsError(key: string): boolean {
  return missing.value.has(key) && (attempted.value || touched.has(key));
}

/**
 * When may the participant press Save?
 *
 * Two rules, and both exist because of a dead end:
 *
 * - NOT disabled by missing fields. A greyed button at the foot of a long form
 *   tells the participant nothing; pressing it now reveals every error, lists
 *   what is missing, and moves focus to the first one.
 * - NOT gated on `dirty` for a FIRST registration. Every contest created through
 *   the editor stores an empty `registrationTemplate` and therefore falls back to
 *   `DEFAULT_REGISTRATION_TEMPLATE`, whose three fields are ALL optional. A
 *   pristine form on such a contest collects `{}`, which is not dirty — so the
 *   only CTA on the page a new arrival lands on ("Log in to register" routes
 *   straight here) was permanently greyed, and answering nothing is a legitimate
 *   way to register on an all-optional form.
 *
 * Editing already-saved details still requires a change, where "nothing to save"
 * is honest rather than a dead end.
 */
const canSave = computed(() => !props.registering && (dirty.value || !props.alreadyRegistered));

/** The missing fields, in template order, as {key,label} for the summary. */
const missingList = computed(() =>
  shownFields.value.filter((f) => missing.value.has(f.key)).map((f) => ({ key: f.key, label: f.label })),
);

const formRef = ref<HTMLElement | null>(null);
/** Move focus to a field's control (or its group), for the summary links. */
function focusField(key: string): void {
  const root = formRef.value;
  if (!root) return;
  const esc = CSS.escape(`${props.idPrefix}-${key}`);

  // The element carrying the field id is sometimes the control itself (text,
  // select, checkbox…) and sometimes a <span> label (agreement, radio, address,
  // file, signature). Rather than enumerate which is which — a list that goes
  // stale the moment a field type is added — take the id'd element when it is
  // focusable, and otherwise the first focusable control inside its field
  // container.
  const anchor = root.querySelector<HTMLElement>(`#${esc}`);
  const FOCUSABLE = 'input:not([type="hidden"]), select, textarea, button';
  const container = anchor?.closest<HTMLElement>('.cpub-subfield')
    ?? root.querySelector<HTMLElement>(`[aria-labelledby="${props.idPrefix}-${key}"]`)
    ?? undefined;

  const target = anchor?.matches(FOCUSABLE)
    ? anchor
    : container?.querySelector<HTMLElement>(FOCUSABLE) ?? anchor ?? undefined;

  if (target && typeof target.focus === 'function') target.focus();
  // Guarded: `scrollIntoView` is absent in jsdom, and an exception here would
  // abort the handler after focus has moved, for a purely cosmetic step.
  const scrollTarget = anchor ?? target;
  if (typeof scrollTarget?.scrollIntoView === 'function') scrollTarget.scrollIntoView({ block: 'center' });
}

function save(): void {
  if (!canSave.value) return;
  if (missing.value.size) {
    attempted.value = true;
    const first = missingList.value[0];
    if (first) nextTick(() => focusField(first.key));
    return;
  }
  emit('save', collected.value);
}
</script>

<template>
  <div ref="formRef" class="cpub-regform">
    <fieldset class="cpub-regform-fields" :disabled="preview">
      <div
        v-for="(f, fi) in shownFields"
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
        <ContestSubmissionField
          :field="f"
          :id-prefix="idPrefix"
          :invalid="showsError(f.key)"
          v-model="values[f.key]"
          @focusout="markTouched(f.key)"
        />
        <!-- Preview only: the panel is labelled "what participants see", and it
             deliberately shows every field so the operator can inspect the ones a
             preview has no way to reveal. Marking them keeps that label honest. -->
        <p v-if="preview && f.showWhen" class="cpub-regform-conditional">
          <i class="fa-solid fa-code-branch"></i>
          Shown only when “{{ labelOfKey(f.showWhen.field) }}” is {{ conditionValueSummary(f) }}
        </p>
        <!-- The id is what `ContestSubmissionField` points `aria-describedby` at
             while the field is invalid; the two are pinned by a test. -->
        <p v-if="showsError(f.key)" :id="`${idPrefix}-${f.key}-error`" class="cpub-regform-missing">This field is required.</p>
      </div>
    </fieldset>

    <!-- What is still needed, next to the control that acts on it. Announced once
         the participant has tried to save, with each entry focusing its field. -->
    <div v-if="!preview && attempted && missingList.length" class="cpub-regform-summary" role="alert">
      <p class="cpub-regform-summary-title">
        {{ missingList.length === 1 ? 'One answer is still needed' : `${missingList.length} answers are still needed` }}
      </p>
      <ul class="cpub-regform-summary-list">
        <li v-for="m in missingList" :key="m.key">
          <button type="button" class="cpub-regform-summary-link" @click="focusField(m.key)">{{ m.label }}</button>
        </li>
      </ul>
    </div>

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
.cpub-regform-conditional { display: flex; align-items: baseline; gap: var(--space-2); font-size: 11px; color: var(--text-dim); margin: -4px 0 4px; }
.cpub-regform-conditional i { color: var(--accent); }
.cpub-regform-summary { border: var(--border-width-default) solid var(--red-border); background: var(--red-bg); padding: var(--space-3) var(--space-4); margin-top: var(--space-3); }
.cpub-regform-summary-title { font-size: var(--text-sm); font-weight: var(--font-weight-bold); color: var(--red-text); margin: 0 0 var(--space-2); }
.cpub-regform-summary-list { margin: 0; padding-left: var(--space-4); font-size: var(--text-xs); }
.cpub-regform-summary-link { background: none; border: none; padding: 0; font: inherit; color: var(--red-text); text-decoration: underline; cursor: pointer; text-align: left; }
.cpub-regform-summary-link:hover { color: var(--text); }
.cpub-regform-save { width: 100%; justify-content: center; margin-top: var(--space-2); }
</style>
