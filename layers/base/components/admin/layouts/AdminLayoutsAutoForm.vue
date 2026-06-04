<script setup lang="ts">
/**
 * AdminLayoutsAutoForm — the recursive native-input renderer for a
 * normalized `AutoFormField[]` (Phase 3e). Controlled component: takes
 * `modelValue` (the config object), renders one control per field, emits
 * `update:modelValue` with a fresh object on every edit. Recurses into
 * itself for `group` (nested object) + `array` (repeater) controls.
 *
 * Shared by `<AdminLayoutsInspectorSection>` (section config) +
 * `<AdminLayoutsInspectorRow>` (row config) — one code path serves every
 * registered section's auto-form. Reuses the `cpub-inspector-page-*`
 * design language (mono uppercase labels, 2px borders, sharp corners) via
 * its own `cpub-autoform-*` classes so it composes the same way without
 * structurally coupling to the page-meta form (feedback-view-identity-classes).
 *
 * Errors: `errors` is a flat map keyed by DOT-joined config path
 * (`ctas.0.href`). Each field looks itself up via the accumulated
 * `pathPrefix`. Surfaced inline; the section validates against the Zod
 * schema and passes the map down.
 *
 * Pure-presentation: zero hardcoded colors/fonts (CLAUDE.md #3). No
 * pointer-events / visibility cascades on interactive children — the
 * controls are plain native inputs (feedback-css-cascade-unit-test-blind-spot).
 */
import type { AutoFormField } from '../../../composables/autoFormSchema';

defineOptions({ name: 'AdminLayoutsAutoForm' });

const props = withDefaults(
  defineProps<{
    fields: AutoFormField[];
    modelValue: Record<string, unknown>;
    /** Flat error map keyed by dot-joined config path. */
    errors?: Record<string, string>;
    /** Accumulated path prefix for nested groups/arrays. Root = ''. */
    pathPrefix?: string;
    /** Stable id seed so generated control ids don't collide across forms. */
    idSeed?: string;
  }>(),
  { errors: () => ({}), pathPrefix: '', idSeed: 'autoform' },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

function pathOf(key: string): string {
  return props.pathPrefix ? `${props.pathPrefix}.${key}` : key;
}

function controlId(key: string): string {
  return `cpub-${props.idSeed}-${pathOf(key).replace(/\./g, '-')}`;
}

function errorFor(key: string): string | undefined {
  return props.errors[pathOf(key)];
}

/** Emit a new config object with one key replaced. */
function setKey(key: string, value: unknown): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function valueOf(field: AutoFormField): unknown {
  const v = props.modelValue[field.key];
  return v === undefined ? field.defaultValue : v;
}

// --- scalar handlers (coerce native string/checkbox values per control) ---

function onText(field: AutoFormField, e: Event): void {
  setKey(field.key, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function onNumber(field: AutoFormField, e: Event): void {
  const raw = (e.target as HTMLInputElement).value;
  // Empty input → clear back to the default (or undefined) rather than NaN.
  setKey(field.key, raw === '' ? field.defaultValue : Number(raw));
}

function onToggle(field: AutoFormField, e: Event): void {
  setKey(field.key, (e.target as HTMLInputElement).checked);
}

function onSelect(field: AutoFormField, e: Event): void {
  const raw = (e.target as HTMLSelectElement).value;
  // The leading "— Default —" option (optional fields) clears the key so
  // the renderer falls back to its own default instead of a forced choice.
  if (raw === '' && field.optional) {
    setKey(field.key, undefined);
    return;
  }
  // Numeric-const selects (heading.level, columns) must store numbers —
  // <select> always yields strings. Coerce when every option is numeric.
  const numeric = field.options?.every((o) => typeof o.value === 'number');
  setKey(field.key, numeric ? Number(raw) : raw);
}

// --- array (repeater) handlers ---

function arrayValue(field: AutoFormField): Record<string, unknown>[] {
  const v = props.modelValue[field.key];
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function addItem(field: AutoFormField): void {
  const items = arrayValue(field);
  if (field.maxItems !== undefined && items.length >= field.maxItems) return;
  const blank = JSON.parse(JSON.stringify(field.itemDefault ?? {}));
  setKey(field.key, [...items, blank]);
}

function removeItem(field: AutoFormField, index: number): void {
  const items = arrayValue(field);
  setKey(field.key, items.filter((_, i) => i !== index));
}

function updateItem(field: AutoFormField, index: number, value: Record<string, unknown>): void {
  const items = arrayValue(field);
  setKey(field.key, items.map((it, i) => (i === index ? value : it)));
}

function groupValue(field: AutoFormField): Record<string, unknown> {
  const v = props.modelValue[field.key];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
</script>

<template>
  <div class="cpub-autoform">
    <template v-for="f in fields" :key="f.key">
      <!-- TOGGLE (boolean) -->
      <div v-if="f.control === 'toggle'" class="cpub-autoform-checkbox">
        <input
          :id="controlId(f.key)"
          type="checkbox"
          :checked="!!valueOf(f)"
          @change="onToggle(f, $event)"
        />
        <label :for="controlId(f.key)">{{ f.label }}</label>
      </div>

      <!-- ARRAY (repeater of object items) -->
      <fieldset v-else-if="f.control === 'array'" class="cpub-autoform-array">
        <legend class="cpub-autoform-label">
          {{ f.label }}
          <span v-if="f.maxItems !== undefined" class="cpub-autoform-count">
            {{ arrayValue(f).length }}/{{ f.maxItems }}
          </span>
        </legend>

        <p v-if="arrayValue(f).length === 0" class="cpub-autoform-empty">
          No {{ f.label.toLowerCase() }} yet.
        </p>

        <div
          v-for="(item, i) in arrayValue(f)"
          :key="i"
          class="cpub-autoform-array-item"
        >
          <div class="cpub-autoform-array-item-head">
            <span class="cpub-autoform-array-item-index">{{ i + 1 }}</span>
            <button
              type="button"
              class="cpub-autoform-array-remove"
              :aria-label="`Remove ${f.label.toLowerCase()} ${i + 1}`"
              @click="removeItem(f, i)"
            >
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
          </div>
          <AdminLayoutsAutoForm
            :fields="f.itemFields ?? []"
            :model-value="item"
            :errors="errors"
            :path-prefix="`${pathOf(f.key)}.${i}`"
            :id-seed="idSeed"
            @update:model-value="updateItem(f, i, $event)"
          />
        </div>

        <button
          type="button"
          class="cpub-autoform-array-add"
          :disabled="f.maxItems !== undefined && arrayValue(f).length >= f.maxItems"
          @click="addItem(f)"
        >
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          Add {{ f.label.toLowerCase().replace(/s$/, '') }}
        </button>
      </fieldset>

      <!-- GROUP (nested object) -->
      <fieldset v-else-if="f.control === 'group'" class="cpub-autoform-group">
        <legend class="cpub-autoform-label">{{ f.label }}</legend>
        <AdminLayoutsAutoForm
          :fields="f.fields ?? []"
          :model-value="groupValue(f)"
          :errors="errors"
          :path-prefix="pathOf(f.key)"
          :id-seed="idSeed"
          @update:model-value="setKey(f.key, $event)"
        />
      </fieldset>

      <!-- SCALAR FIELDS (text / textarea / number / select / unsupported) -->
      <div v-else class="cpub-autoform-field">
        <label :for="controlId(f.key)" class="cpub-autoform-label">
          {{ f.label }}
          <span v-if="f.required" class="cpub-autoform-required" aria-hidden="true">*</span>
        </label>

        <select
          v-if="f.control === 'select'"
          :id="controlId(f.key)"
          :value="valueOf(f) ?? ''"
          :aria-invalid="!!errorFor(f.key)"
          :aria-describedby="errorFor(f.key) ? `${controlId(f.key)}-err` : undefined"
          @change="onSelect(f, $event)"
        >
          <!-- Optional fields (no default) get a leading unset option so an
               undefined value reads as "default", not the first real choice. -->
          <option v-if="f.optional" value="">- Default -</option>
          <option v-for="opt in f.options" :key="String(opt.value)" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <textarea
          v-else-if="f.control === 'textarea'"
          :id="controlId(f.key)"
          :value="String(valueOf(f) ?? '')"
          :maxlength="f.maxLength"
          rows="4"
          :aria-invalid="!!errorFor(f.key)"
          :aria-describedby="errorFor(f.key) ? `${controlId(f.key)}-err` : undefined"
          @input="onText(f, $event)"
        ></textarea>

        <input
          v-else-if="f.control === 'number'"
          :id="controlId(f.key)"
          type="number"
          :value="valueOf(f)"
          :min="f.min"
          :max="f.max"
          :step="f.step"
          :aria-invalid="!!errorFor(f.key)"
          :aria-describedby="errorFor(f.key) ? `${controlId(f.key)}-err` : undefined"
          @input="onNumber(f, $event)"
        />

        <input
          v-else-if="f.control === 'text'"
          :id="controlId(f.key)"
          type="text"
          :value="String(valueOf(f) ?? '')"
          :maxlength="f.maxLength"
          autocomplete="off"
          :aria-invalid="!!errorFor(f.key)"
          :aria-describedby="errorFor(f.key) ? `${controlId(f.key)}-err` : undefined"
          @input="onText(f, $event)"
        />

        <!-- unsupported control (forward-compat for new Zod kinds) -->
        <p v-else class="cpub-autoform-unsupported">
          This field type isn’t editable here yet.
        </p>

        <p v-if="errorFor(f.key)" :id="`${controlId(f.key)}-err`" class="cpub-autoform-error" role="alert">
          {{ errorFor(f.key) }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cpub-autoform {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-autoform-field { display: flex; flex-direction: column; gap: var(--space-1); }

.cpub-autoform-label {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
  font-weight: var(--font-weight-semibold);
}
.cpub-autoform-required { color: var(--red); margin-left: 2px; }
.cpub-autoform-count {
  color: var(--text-faint);
  font-weight: var(--font-weight-normal);
  margin-left: var(--space-1);
}

.cpub-autoform-field input,
.cpub-autoform-field textarea,
.cpub-autoform-field select {
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  border-radius: 0;
}
.cpub-autoform-field textarea { resize: vertical; }
.cpub-autoform-field input:focus-visible,
.cpub-autoform-field textarea:focus-visible,
.cpub-autoform-field select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: var(--accent);
}
/* Invalid state — red border + the inline message below carries the why. */
.cpub-autoform-field input[aria-invalid='true'],
.cpub-autoform-field textarea[aria-invalid='true'],
.cpub-autoform-field select[aria-invalid='true'] {
  border-color: var(--red);
}
.cpub-autoform-error {
  font-size: var(--text-xs);
  color: var(--red);
  margin: 0;
}
.cpub-autoform-unsupported {
  font-size: var(--text-xs);
  color: var(--text-faint);
  font-style: italic;
  margin: 0;
}

.cpub-autoform-checkbox { display: flex; align-items: center; gap: var(--space-2); }
.cpub-autoform-checkbox label { font-size: var(--text-sm); color: var(--text); }
.cpub-autoform-checkbox input { cursor: pointer; }

/* Array repeater + nested group share a bordered card so the nesting is
   visually obvious without indentation drift. */
.cpub-autoform-array,
.cpub-autoform-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  /* fieldset defaults to min-inline-size: min-content, which refuses to
     shrink below its content + overflows the 320px inspector. Force it to
     shrink with its container. */
  min-width: 0;
  padding: var(--space-3);
  border: var(--border-width-default) solid var(--border2);
  border-radius: 0;
}
.cpub-autoform-array legend,
.cpub-autoform-group legend { padding: 0 var(--space-1); }

.cpub-autoform-empty {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin: 0;
}

.cpub-autoform-array-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--surface2);
  border: 1px solid var(--border2);
}
.cpub-autoform-array-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cpub-autoform-array-item-index {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-dim);
}
.cpub-autoform-array-remove {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text-dim);
  cursor: pointer;
  font-size: var(--text-xs);
}
.cpub-autoform-array-remove:hover { color: var(--red); border-color: var(--red); }
.cpub-autoform-array-remove:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.cpub-autoform-array-add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
}
.cpub-autoform-array-add:hover:not(:disabled) { background: var(--surface2); border-color: var(--accent); color: var(--accent); }
.cpub-autoform-array-add:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-autoform-array-add:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
