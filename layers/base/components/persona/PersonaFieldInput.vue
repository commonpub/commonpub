<script setup lang="ts">
/**
 * `<PersonaFieldInput>` — one non-`multiselect` persona field.
 *
 * Registered as `<PersonaFieldInput>` by Nuxt's pathPrefix (directory `persona`
 * deduplicated against the `Persona` filename prefix). Imported by path from
 * `<PersonaSectionEditor>` regardless, so the prefix only matters outside this
 * tree.
 *
 * `multiselect` is deliberately NOT handled here: it is the chip grid, and
 * routing it through a shared "render any type" switch is how the grid ends up
 * as a `<select multiple>` on some future refactor. `<PersonaSectionEditor>`
 * picks the renderer once, from `field.type`.
 *
 * THE MODEL IS ALWAYS A STRING, which is the wire shape the server's
 * `PersonaSectionAnswers` takes for a scalar field. A ticked `checkbox` is
 * `PERSONA_CHECKBOX_VALUE` from `@commonpub/persona`, NOT a locally invented
 * `'true'`: the write path normalises both spellings, so a hardcoded `'true'`
 * survived every save and then read back UNTICKED, because the stored value that
 * comes back is `'yes'`. That is why the canonical value lives in the brain
 * package where this component can import it. Note the deliberate `:value` + `@input` on the number field rather than
 * `v-model`: Vue casts `v-model` on `type="number"` to a JavaScript number,
 * which silently breaks every string helper downstream of it.
 *
 * VALIDATION IS DOMAIN, NOT SHAPE. A `url` field runs the real http(s)
 * allowlist from `@commonpub/persona` (the one that rejects `javascript:`), and
 * a `link` field additionally runs the platform's host check, so
 * `https://evilgithub.com/x` is refused for `github` before it ever reaches the
 * server. The server validates again; this is the inline explanation, not the
 * gate.
 */
import { computed, watch } from 'vue';
import type { PersonaField, PersonaLinkPlatformSpec } from '@commonpub/persona';
import {
  PERSONA_CHECKBOX_VALUE,
  httpUrl,
  linkUrlMatchesPlatform,
  personaFieldSpec,
} from '@commonpub/persona';

const props = withDefaults(defineProps<{
  field: PersonaField;
  /** The resolved platform for a `link` field. Absent for every other type. */
  platform?: PersonaLinkPlatformSpec | null;
  idPrefix?: string;
  disabled?: boolean;
}>(), { platform: null, idPrefix: 'cpub-persona', disabled: false });

const emit = defineEmits<{
  /** Fired immediately and on every change, so a parent can gate its Save. */
  (e: 'validity', valid: boolean): void;
}>();

const model = defineModel<string>({ default: '' });

const fieldId = computed(() => `${props.idPrefix}-${props.field.key}`);
const helpId = computed(() => (props.field.help ? `${fieldId.value}-help` : null));
const errorId = computed(() => `${fieldId.value}-error`);

const spec = computed(() => personaFieldSpec(props.field.type));
const options = computed(() => props.field.options ?? []);

/** Only the registry's own answer decides whether a length cap applies. */
const maxLength = computed<number | undefined>(() =>
  spec.value.supportsMaxLength && typeof props.field.maxLength === 'number'
    ? props.field.maxLength
    : undefined);

const checked = computed(() => model.value === PERSONA_CHECKBOX_VALUE);

/**
 * The inline problem with the current value, or `null`. An EMPTY value is never
 * a problem: persona has no `required`, by design, so "you left it blank" is
 * not a thing this system can say.
 */
const errorMessage = computed<string | null>(() => {
  const raw = model.value?.trim() ?? '';
  if (raw === '') return null;

  if (props.field.type === 'url') {
    const parsed = httpUrl(maxLength.value).safeParse(raw);
    return parsed.success ? null : 'Enter a full web address starting with http:// or https://';
  }

  if (props.field.type === 'link') {
    const parsed = httpUrl(512).safeParse(raw);
    if (!parsed.success) return 'Enter a full web address starting with http:// or https://';
    const platform = props.platform;
    if (!platform) return null;
    if (!linkUrlMatchesPlatform(raw, platform)) {
      // Name the platform and show an example: "that is not a github.com link"
      // is only actionable next to the shape we expect.
      return `This does not look like a ${platform.label} address. Example: ${platform.placeholder}`;
    }
    return null;
  }

  return null;
});

const describedBy = computed<string | undefined>(() => {
  const ids = [helpId.value, errorMessage.value ? errorId.value : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
});

watch(errorMessage, (msg) => emit('validity', msg === null), { immediate: true });

function setChecked(on: boolean): void {
  model.value = on ? PERSONA_CHECKBOX_VALUE : '';
}

function setValue(event: Event): void {
  model.value = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

function clearChoice(): void {
  model.value = '';
}
</script>

<template>
  <!-- Layout-only. A styled div, not an <h*>: injecting a heading here would
       corrupt the outline of whatever page the editor is embedded in, and the
       level would depend on the caller. -->
  <div v-if="field.type === 'section'" class="cpub-persona-field">
    <div class="cpub-persona-field-heading">{{ field.label }}</div>
    <p v-if="field.help" class="cpub-persona-field-help">{{ field.help }}</p>
  </div>

  <!-- Single boolean. The label wraps the input so the whole row is the target. -->
  <div v-else-if="field.type === 'checkbox'" class="cpub-persona-field">
    <label class="cpub-persona-field-choice">
      <input
        :id="fieldId"
        type="checkbox"
        :checked="checked"
        :disabled="disabled"
        :aria-describedby="describedBy"
        @change="setChecked(($event.target as HTMLInputElement).checked)"
      />
      <span>{{ field.label }}</span>
    </label>
    <p v-if="helpId" :id="helpId" class="cpub-persona-field-help">{{ field.help }}</p>
  </div>

  <!-- Single choice. A radio group cannot be un-picked with the keyboard alone,
       so an explicit Clear control ships with it: "optional" has to stay
       reversible or it is not optional. -->
  <fieldset v-else-if="field.type === 'radio'" class="cpub-persona-field cpub-chip-fieldset" role="group">
    <legend class="cpub-persona-field-label">{{ field.label }}</legend>
    <p v-if="helpId" :id="helpId" class="cpub-persona-field-help">{{ field.help }}</p>
    <div class="cpub-persona-field-choices">
      <label v-for="o in options" :key="o.value" class="cpub-persona-field-choice">
        <input
          type="radio"
          :name="fieldId"
          :value="o.value"
          :checked="model === o.value"
          :disabled="disabled"
          :aria-describedby="describedBy"
          @change="setValue"
        />
        <span>{{ o.label }}</span>
      </label>
    </div>
    <button
      v-if="model"
      type="button"
      class="cpub-btn cpub-btn-sm"
      :disabled="disabled"
      @click="clearChoice"
    >Clear {{ field.label }}</button>
  </fieldset>

  <!-- `multiselect` is the chip grid's job. Rendering NOTHING here is
       deliberate: the alternative, falling through to the generic text input
       below, would silently ship a one-line text box where a 34-checkbox grid
       belongs, and it would look like a working control. A test pins this. -->
  <template v-else-if="field.type === 'multiselect'"></template>

  <!-- Everything else: one label, one control, help underneath. -->
  <div v-else class="cpub-persona-field">
    <label class="cpub-persona-field-label" :for="fieldId">{{ field.label }}</label>

    <textarea
      v-if="field.type === 'textarea'"
      :id="fieldId"
      class="cpub-form-input cpub-form-textarea"
      rows="4"
      :value="model"
      :maxlength="maxLength"
      :disabled="disabled"
      :aria-describedby="describedBy"
      @input="setValue"
    ></textarea>

    <select
      v-else-if="field.type === 'select'"
      :id="fieldId"
      class="cpub-select"
      :value="model"
      :disabled="disabled"
      :aria-describedby="describedBy"
      @change="setValue"
    >
      <!-- Always present, always first: every persona field is optional, so
           "no answer" must be reachable after an answer was given. -->
      <option value="">No answer</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>

    <input
      v-else
      :id="fieldId"
      class="cpub-form-input cpub-persona-field-input"
      :class="{ 'cpub-persona-field-input--invalid': errorMessage !== null }"
      :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' || field.type === 'link' ? 'url' : 'text'"
      :value="model"
      :maxlength="maxLength"
      :placeholder="field.type === 'link' && platform ? platform.placeholder : undefined"
      :disabled="disabled"
      :aria-invalid="errorMessage !== null ? 'true' : undefined"
      :aria-describedby="describedBy"
      @input="setValue"
    />

    <p v-if="helpId" :id="helpId" class="cpub-persona-field-help">{{ field.help }}</p>
    <!-- role=alert, not a live region on an always-present node: this text only
         exists while the value is wrong, and it is the direct consequence of the
         keystroke that produced it. -->
    <p v-if="errorMessage" :id="errorId" class="cpub-persona-field-error" role="alert">{{ errorMessage }}</p>
  </div>
</template>
