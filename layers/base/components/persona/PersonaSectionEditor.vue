<script setup lang="ts">
/**
 * `<PersonaSectionEditor>` — one collapsible persona section, with its own Save.
 *
 * NAMING: the file is `components/persona/PersonaSectionEditor.vue`. Nuxt's
 * pathPrefix prepends the directory name and DEDUPLICATES it against the
 * filename, so this registers as `<PersonaSectionEditor>` exactly as
 * `components/admin/theme/AdminThemeFamilyCard.vue` registers as
 * `<AdminThemeFamilyCard>`. Naming the file `SectionEditor.vue` would ALSO give
 * `<PersonaSectionEditor>`, and a bare `<SectionEditor>` would render empty with
 * no error and no test failure. Children are imported by path so this tree is
 * immune to the whole class.
 *
 * THE DISCLOSURE IS A REAL BUTTON. `<button aria-expanded aria-controls>`
 * toggling a region, not a `<div role="button">` (a role=button container with
 * button children is a spec violation this codebase has shipped once) and not
 * `<details>` (whose open state cannot be driven from the outside, which
 * deep-linking to a section requires).
 *
 * SAVE IS PER SECTION, DIRTY-GATED, EXPLICIT.
 *  - Per section, because a 34-checkbox page must not lose everything to one
 *    rejected URL in an unrelated section.
 *  - Dirty-gated, so "Save" is never a no-op that writes a consent-adjacent
 *    record for nothing.
 *  - Explicit, NOT autosave. A silent background write on a privacy-relevant
 *    surface is the wrong affordance: the person has to be the one who decides
 *    the data is written.
 *
 * NOTHING HERE IS REQUIRED. There is no `required` in the persona field shape,
 * by design, so this component has no concept of a blocking empty value. The
 * only thing that can block Save is a value that is actively wrong, which today
 * means a malformed URL or a link that does not belong to its platform.
 */
import { computed, reactive, ref, watch } from 'vue';
import type { PersonaField, PersonaLinkPlatformSpec, PersonaSection } from '@commonpub/persona';
import { effectiveLinkPlatforms, findLinkPlatform, personaFieldSpec } from '@commonpub/persona';
import PersonaChipGrid from './PersonaChipGrid.vue';
import PersonaFieldInput from './PersonaFieldInput.vue';

/**
 * What the caller submits for one section: one entry per field the user touched
 * or cleared. `null` and `''` both mean "cleared", which is what makes the
 * server's template-scoped delete work.
 *
 * Structurally identical to `PersonaSectionAnswers` in `@commonpub/server`, and
 * declared here rather than imported for the reason spelled out in
 * `PersonaRetiredData.vue`: `<script setup>` cannot export types and a shared
 * `.ts` file inside a Nuxt components directory is scanned as a component.
 */
type SectionAnswers = Record<string, string | string[] | null>;

const props = withDefaults(defineProps<{
  section: PersonaSection;
  /**
   * Saved values for this section's fields, keyed by field key. A scalar field
   * holds a string; a `multiselect` holds an array. Anything absent is unfilled.
   * This is the SSR'd persona DTO flattened by the page, never a client fetch.
   */
  values?: Readonly<Record<string, string | string[]>>;
  /**
   * Operator-declared link platforms. UNIONED with the built-ins below, so a
   * caller that passes nothing still gets real host validation on the seven
   * built-in platforms instead of silently accepting any http(s) URL for
   * `github`. An omitted prop must never weaken a check.
   */
  platforms?: readonly PersonaLinkPlatformSpec[];
  /**
   * Position in the rendered list. Drives the "first two open" default and
   * nothing else.
   */
  index?: number;
  /** Save in flight. Disables the controls and the Save button. */
  saving?: boolean;
  /** Server-side failure for THIS section, shown inline next to its own Save. */
  error?: string | null;
  idPrefix?: string;
}>(), {
  values: () => ({}),
  platforms: () => [],
  index: 0,
  saving: false,
  error: null,
  idPrefix: 'cpub-persona',
});

const emit = defineEmits<{
  (e: 'save', payload: { sectionKey: string; answers: SectionAnswers }): void;
}>();

/**
 * Controllable open state, for deep linking. When the parent binds
 * `v-model:open` it owns the state entirely; otherwise this falls back to the
 * internal default. Either way the DOM is identical on the server and on first
 * paint, because the default is derived synchronously from props and never from
 * a fetch.
 */
const openModel = defineModel<boolean | undefined>('open', { default: undefined });

/** First two sections open, and `collapsedByDefault` always wins over position. */
const internalOpen = ref<boolean>(props.index < 2 && props.section.collapsedByDefault !== true);

const isOpen = computed<boolean>(() =>
  openModel.value === undefined ? internalOpen.value : openModel.value === true);

function toggle(): void {
  const next = !isOpen.value;
  internalOpen.value = next;
  if (openModel.value !== undefined) openModel.value = next;
}

const sectionId = computed(() => `${props.idPrefix}-${props.section.key}`);
const regionId = computed(() => `${sectionId.value}-region`);
const toggleId = computed(() => `${sectionId.value}-toggle`);

/** Layout-only fields are rendered but never saved and never counted. */
const answerableFields = computed<PersonaField[]>(() =>
  props.section.fields.filter((f) => personaFieldSpec(f.type).cardinality !== 'none'));

function isMulti(field: PersonaField): boolean {
  return field.type === 'multiselect';
}

/**
 * Built-ins plus whatever the operator declared, deduped with the BUILT-IN
 * winning. `effectiveLinkPlatforms` is the single source of that rule, so an
 * operator cannot redefine `github` to point at a host they control, and an
 * empty prop resolves to exactly the built-in seven.
 */
const effectivePlatforms = computed(() => effectiveLinkPlatforms(props.platforms));

function platformFor(field: PersonaField): PersonaLinkPlatformSpec | null {
  if (field.type !== 'link' || !field.platform) return null;
  return findLinkPlatform(effectivePlatforms.value, field.platform) ?? null;
}

// --- The draft ------------------------------------------------------------------

/**
 * The editable copy. Seeded SYNCHRONOUSLY during setup, not inside a
 * `watch(..., { immediate: true })` callback, so server and client render the
 * same thing. Re-seeded only when the saved values themselves change, which is
 * what a successful save does.
 */
const scalars = reactive<Record<string, string>>({});
const sets = reactive<Record<string, string[]>>({});

function baselineScalar(field: PersonaField): string {
  const raw = props.values[field.key];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0] ?? '';
  return '';
}

function baselineSet(field: PersonaField): string[] {
  const raw = props.values[field.key];
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw === 'string' && raw !== '') return [raw];
  return [];
}

function seed(): void {
  for (const k of Object.keys(scalars)) delete scalars[k];
  for (const k of Object.keys(sets)) delete sets[k];
  for (const field of answerableFields.value) {
    if (isMulti(field)) sets[field.key] = baselineSet(field);
    else scalars[field.key] = baselineScalar(field);
  }
}
seed();

watch(() => props.values, seed, { deep: true });
watch(() => props.section, seed, { deep: true });

// --- Validity -------------------------------------------------------------------

/**
 * Per-field validity reported by `<PersonaFieldInput>`, so the message and the
 * gate come from ONE evaluation. Deriving the gate separately here would be two
 * implementations of "is this URL acceptable" that drift.
 */
const invalidKeys = reactive<Set<string>>(new Set());

function setValidity(fieldKey: string, valid: boolean): void {
  if (valid) invalidKeys.delete(fieldKey);
  else invalidKeys.add(fieldKey);
}

const hasInvalid = computed(() => invalidKeys.size > 0);

// --- Dirty --------------------------------------------------------------------

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((v) => bs.has(v));
}

const dirty = computed<boolean>(() => {
  for (const field of answerableFields.value) {
    if (isMulti(field)) {
      if (!sameSet(sets[field.key] ?? [], baselineSet(field))) return true;
    } else if ((scalars[field.key] ?? '').trim() !== baselineScalar(field).trim()) {
      return true;
    }
  }
  return false;
});

const canSave = computed(() => dirty.value && !hasInvalid.value && !props.saving);

/**
 * One entry per TEMPLATE field, not per touched field. That is the whole point:
 * the server's delete is scoped to what it is sent, so omitting a cleared field
 * would make "uncheck everything" a silent no-op, which is a data-subject-rights
 * bug wearing an off-by-one costume.
 */
function collect(): SectionAnswers {
  const answers: SectionAnswers = {};
  for (const field of answerableFields.value) {
    if (isMulti(field)) answers[field.key] = [...(sets[field.key] ?? [])];
    else answers[field.key] = (scalars[field.key] ?? '').trim();
  }
  return answers;
}

function save(): void {
  if (!canSave.value) return;
  emit('save', { sectionKey: props.section.key, answers: collect() });
}

function discard(): void {
  seed();
  invalidKeys.clear();
}

const filledCount = computed(() =>
  answerableFields.value.filter((f) =>
    isMulti(f) ? (sets[f.key]?.length ?? 0) > 0 : (scalars[f.key] ?? '').trim() !== '').length);
</script>

<template>
  <section class="cpub-persona-section">
    <h3 class="cpub-persona-section-heading">
      <button
        :id="toggleId"
        type="button"
        class="cpub-persona-section-toggle"
        :aria-expanded="isOpen"
        :aria-controls="regionId"
        @click="toggle"
      >
        <i
          class="fa-solid"
          :class="isOpen ? 'fa-chevron-down' : 'fa-chevron-right'"
          aria-hidden="true"
        ></i>
        <span class="cpub-persona-section-title">{{ section.label }}</span>
        <span class="cpub-persona-section-count">
          {{ filledCount }} of {{ answerableFields.length }}
          <span v-if="dirty"> (unsaved)</span>
        </span>
      </button>
    </h3>

    <!-- The region stays in the DOM and is hidden, so aria-controls always
         resolves to a real element and a deep link can open it without a
         re-render race. -->
    <div :id="regionId" class="cpub-persona-section-body" role="region" :aria-labelledby="toggleId" :hidden="!isOpen">
      <p v-if="section.help" class="cpub-persona-section-help">{{ section.help }}</p>

      <template v-for="field in section.fields" :key="field.key">
        <PersonaChipGrid
          v-if="field.type === 'multiselect'"
          v-model="sets[field.key]"
          :field="field"
          :id-prefix="sectionId"
          :disabled="saving"
        />
        <PersonaFieldInput
          v-else
          v-model="scalars[field.key]"
          :field="field"
          :platform="platformFor(field)"
          :id-prefix="sectionId"
          :disabled="saving"
          @validity="(valid: boolean) => setValidity(field.key, valid)"
        />
      </template>

      <div class="cpub-persona-section-actions">
        <button
          type="button"
          class="cpub-btn cpub-btn-sm cpub-btn-primary"
          :disabled="!canSave"
          @click="save"
        >{{ saving ? 'Saving...' : `Save ${section.label}` }}</button>

        <!-- Equal-weight: a real button of the same size, never a text link
             beside a filled button. -->
        <button
          v-if="dirty"
          type="button"
          class="cpub-btn cpub-btn-sm"
          :disabled="saving"
          @click="discard"
        >Discard changes</button>

        <p v-if="error" class="cpub-persona-section-error" role="alert">{{ error }}</p>
        <p v-else-if="hasInvalid" class="cpub-persona-section-status">
          Fix the highlighted answer before saving.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The heading exists only to carry the button into the document outline; it
   must not add its own box, spacing or type scale on top of the toggle's. */
.cpub-persona-section-heading {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
}

/* The collapsed region stays in the DOM (so `aria-controls` always resolves and
   a deep link can open it) and is hidden by the attribute. Restated here rather
   than trusting the UA sheet, because the canonical `.cpub-persona-section-body`
   rule in components.css sets padding and a future `display` there would beat
   `[hidden]` on specificity and silently un-collapse every section. */
.cpub-persona-section-body[hidden] {
  display: none;
}
</style>
