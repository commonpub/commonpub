<script setup lang="ts">
/**
 * /settings/persona — the persona editor (plan section 8.1).
 *
 * This page is a COMPOSER. It owns fetching, per-section saving, error surfacing
 * and the retired-data delete call. It owns no field rendering: the chip grids,
 * the field inputs, the section disclosure and the completeness meter all live in
 * `layers/base/components/persona/` and are auto-registered with the `Persona`
 * path prefix (`components/persona/SectionEditor.vue` -> `<PersonaSectionEditor>`;
 * a bare `<SectionEditor>` renders EMPTY with no error and no test failure).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE PASSES DOWN
 * ---------------------------------------------------------------------------
 * <PersonaCompletenessMeter :completeness />
 * <PersonaSectionEditor :section :values :index :saving :error @save />
 * <PersonaRetiredData :items :deleting-key @delete />
 *
 * `values` is a FLAT map for one section's field keys only, merged across the
 * four storage partitions the API returns, with unfilled keys OMITTED (the
 * component's prop type carries no null). A `multiselect` key holds a `string[]`;
 * every other answerable key holds a `string`. The partition itself is never
 * re-derived here: `personaFieldSink` lives in `@commonpub/persona` and this page
 * does not import it, so the server's partitioned DTO is the only source.
 *
 * `PersonaSectionEditor` owns its own open state (first two open, honouring
 * `collapsedByDefault`) from `:index`, so this page holds no expansion state.
 *
 * ---------------------------------------------------------------------------
 * ROUTES CONSUMED
 * ---------------------------------------------------------------------------
 * GET    /api/persona                     -> PersonaReadResponse (below)
 * PUT    /api/persona                     -> { sectionKey, answers }, one section
 * DELETE /api/persona/retired/[fieldKey]  -> erases one retired field's rows
 *
 * Consent is deliberately absent from this page. There is one non-blocking line
 * pointing at Privacy settings and no inline toggle: bundling a consent ask into
 * a Save button is the pattern the design exists to avoid (plan 6.8).
 */
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Profile Details, ${useSiteName()}` });

const { persona: personaEnabled, dataSharingConsents: consentsEnabled } = useFeatures();
const { show: toast } = useToast();
const { extract } = useApiError();

type PersonaFieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multiselect'
  | 'link'
  | 'section';

interface PersonaFieldDto {
  key: string;
  label: string;
  type: PersonaFieldType;
  help?: string;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  maxSelections?: number;
  platform?: string;
  points?: number;
  pointsPerSelection?: number;
  publicOnProfile?: boolean;
  /**
   * Narrow, not `string`: `PersonaField.column` in `@commonpub/persona` is
   * `UserBridgeColumn`, and a widened local copy would not be assignable to the
   * editor's prop. `website` is deliberately absent (Appendix B1: it is a link
   * platform, and one datum addressable two ways is how one of them writes
   * nowhere).
   */
  column?: 'displayName' | 'bio' | 'headline' | 'location' | 'pronouns';
}

interface PersonaSectionDto {
  key: string;
  label: string;
  help?: string;
  collapsedByDefault?: boolean;
  order?: number;
  fields: PersonaFieldDto[];
}

interface PersonaRetiredDto {
  fieldKey: string;
  values: string[];
  text: string | null;
  retiredAt: string | null;
}

interface PersonaValuesDto {
  answers: Record<string, string[]>;
  text: Record<string, string>;
  links: Record<string, string>;
  columns: Record<string, string>;
  retired: PersonaRetiredDto[];
}

interface PersonaSectionCompletenessDto {
  key: string;
  label: string;
  filledFields: number;
  totalFields: number;
  percent: number;
  filled: boolean;
  points: number;
}

interface PersonaCompletenessDto {
  perSection: PersonaSectionCompletenessDto[];
  filledFields: number;
  totalFields: number;
  percent: number;
  points: number;
}

/**
 * Structurally identical to `PersonaReadResponse` in
 * `layers/base/server/api/persona.get.ts`. Declared here rather than imported
 * because a page importing a server route's module pulls `@commonpub/server`
 * into the client bundle. A rename on the route side turns this page's tests
 * red, which is the trade the duplication buys.
 */
interface PersonaReadResponse {
  sections: PersonaSectionDto[];
  /** The four storage partitions, without the retired block. */
  values: PersonaValuesDto;
  /** Values whose question is no longer in the schema. Top level, not nested. */
  retired: PersonaRetiredDto[];
  completeness: PersonaCompletenessDto;
}

type PersonaSectionAnswers = Record<string, string | string[] | null>;

const { data, pending, refresh } = await useFetch<PersonaReadResponse>('/api/persona', {
  // A disabled feature 404s server-side (`requireFeature`). Never ask for it.
  immediate: personaEnabled.value,
});

const sections = computed<PersonaSectionDto[]>(() => data.value?.sections ?? []);
const retired = computed<PersonaRetiredDto[]>(() => data.value?.retired ?? []);

/**
 * The meter binds to the SSR'd DTO, never to a `ref(0)` seed. A false zero in
 * first paint is a lie in the HTML, not merely a hydration warning; `null` makes
 * the meter render its own busy state instead of a number nobody measured.
 */
const completeness = computed<PersonaCompletenessDto | null>(() => data.value?.completeness ?? null);

const answered = computed<boolean>(() => (completeness.value?.filledFields ?? 0) > 0);

/**
 * One flat value map per section, scoped to that section's declared field keys.
 * Exactly one partition holds any given key, so the lookup order is a lookup and
 * not a precedence rule.
 *
 * An unfilled key is OMITTED rather than set to null: the editor's `values` prop
 * is `Record<string, string | string[]>`, and "absent" is the only way this map
 * can say "unfilled". Clearing travels the other way, in the save payload, where
 * `null` is meaningful.
 */
function sectionValues(section: PersonaSectionDto): Record<string, string | string[]> {
  const values = data.value?.values;
  const out: Record<string, string | string[]> = {};
  if (!values) return out;
  for (const field of section.fields) {
    if (field.type === 'section') continue;
    if (field.type === 'multiselect') {
      const selected = values.answers[field.key];
      if (selected && selected.length) out[field.key] = selected;
      continue;
    }
    const stored =
      values.answers[field.key]?.[0]
      ?? values.text[field.key]
      ?? values.links[field.key]
      ?? values.columns[field.key];
    if (stored !== undefined && stored !== '') out[field.key] = stored;
  }
  return out;
}

/* Save is per section, explicit and dirty-gated by the child. Not one giant
 * form (a 34-checkbox page must not lose everything on one validation error)
 * and not autosave (a silent background write on a privacy-relevant surface is
 * the wrong affordance). */
const savingSection = ref<string | null>(null);
const sectionErrors = ref<Record<string, string | null>>({});

function setSectionError(key: string, message: string | null): void {
  sectionErrors.value = { ...sectionErrors.value, [key]: message };
}

function sectionError(key: string): string | null {
  return sectionErrors.value[key] ?? null;
}

async function saveSection(sectionKey: string, answers: PersonaSectionAnswers): Promise<void> {
  savingSection.value = sectionKey;
  setSectionError(sectionKey, null);
  try {
    await $fetch('/api/persona', { method: 'PUT', body: { sectionKey, answers } });
    await refresh();
    toast('Saved', 'success');
  } catch (err: unknown) {
    // `useApiError` reads `err.data.data.errors`, where h3 actually puts the
    // Zod field errors. Reading `err.data.errors` yields the bare status
    // message, which is how every validation failure in this app once read
    // "Validation failed" with no clue which field was at fault.
    const message = extract(err);
    setSectionError(sectionKey, message);
    toast(message, 'error');
  } finally {
    savingSection.value = null;
  }
}

/**
 * The editor emits `{ sectionKey, answers }`. Unwrapped here rather than in an
 * inline template arrow: a type annotation inside a template expression is not
 * valid template syntax and fails `vue-tsc` with a bare "',' expected", which is
 * a parse error nothing in the test run would have caught.
 */
function onSectionSave(payload: { sectionKey: string; answers: PersonaSectionAnswers }): void {
  void saveSection(payload.sectionKey, payload.answers);
}

const deletingField = ref<string | null>(null);

async function deleteRetiredField(fieldKey: string): Promise<void> {
  deletingField.value = fieldKey;
  try {
    await $fetch(`/api/persona/retired/${encodeURIComponent(fieldKey)}`, { method: 'DELETE' });
    await refresh();
    toast('Deleted', 'success');
  } catch (err: unknown) {
    toast(extract(err), 'error');
  } finally {
    deletingField.value = null;
  }
}
</script>

<template>
  <div class="cpub-persona-settings">
    <h2 class="cpub-section-title-lg">Profile Details</h2>

    <p v-if="!personaEnabled" class="cpub-persona-note">
      Profile details are not enabled on this site.
    </p>

    <template v-else>
      <p class="cpub-persona-intro">
        This is all optional. Fill in what you want people to see. You can change it at any time.
      </p>

      <!--
        The two editors write the same `users` columns for the name, job title,
        location, pronouns and bio, and sit as adjacent tabs called Profile and
        Profile Details. Server-side that is coherent; to a member it is two
        places to change their job title with no hint they are the same field.
      -->
      <p class="cpub-persona-note">
        Your name, photo and bio are on the
        <NuxtLink to="/settings/profile" class="cpub-persona-link">Profile</NuxtLink> tab. Changes
        made in either place are the same answer.
      </p>

      <p v-if="consentsEnabled" class="cpub-persona-note">
        Nothing here is counted or shared anywhere unless you choose that in
        <NuxtLink to="/settings/privacy" class="cpub-persona-link">Privacy settings</NuxtLink>.
      </p>

      <PersonaCompletenessMeter :completeness="completeness" />

      <p v-if="pending && !sections.length" class="cpub-persona-note" aria-busy="true">
        Loading your details...
      </p>

      <p v-else-if="!sections.length" class="cpub-persona-note">
        There is nothing to fill in on this site yet.
      </p>

      <p v-else-if="!answered" class="cpub-persona-note">
        Nothing here yet. Pick whatever you want people to see. You can change it at any time.
      </p>

      <div class="cpub-persona-sections">
        <PersonaSectionEditor
          v-for="(section, index) in sections"
          :key="section.key"
          :section="section"
          :values="sectionValues(section)"
          :index="index"
          :saving="savingSection === section.key"
          :error="sectionError(section.key)"
          @save="onSectionSave"
        />
      </div>

      <PersonaRetiredData
        v-if="retired.length"
        :items="retired"
        :deleting-key="deletingField"
        @delete="deleteRetiredField"
      />
    </template>
  </div>
</template>

<style scoped>
.cpub-persona-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
}

.cpub-persona-intro {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-persona-note {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-faint);
}

.cpub-persona-link {
  color: var(--accent);
  text-decoration: underline;
}

.cpub-persona-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-persona-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
