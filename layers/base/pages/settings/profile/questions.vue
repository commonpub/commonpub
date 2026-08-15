<script setup lang="ts">
/**
 * /settings/profile/questions — the operator's questions, and nothing else
 * unless the operator has configured something else (plan R2.2, R2.3, R3.4
 * phase 2).
 *
 * This is the old `/settings/persona` content re-homed under the merged Profile
 * parent and re-framed. It stays a COMPOSER: it owns fetching, per-section
 * saving, error surfacing and the retired-data delete, and owns no field
 * rendering. The chip grids, the field inputs, the section disclosure and the
 * completeness meter all live in `layers/base/components/persona/` and are
 * auto-registered with the `Persona` path prefix
 * (`components/persona/PersonaSectionEditor.vue` -> `<PersonaSectionEditor>`; a
 * bare `<SectionEditor>` renders EMPTY with no error and no test failure).
 *
 * ---------------------------------------------------------------------------
 * THE FRAMING IS THE POINT
 * ---------------------------------------------------------------------------
 * A persona field is A QUESTION THE OPERATOR ASKED, not profile content the
 * member wrote to be read. A makerspace can run `persona` alone to ask which
 * machines somebody is checked out on, with no recruitment, no sponsors and no
 * statistics anywhere in the building. On that instance this page must not
 * contain one word about sharing, recruiters, sponsors or statistics: copy that
 * describes processing which does not happen there is not a disclosure, it is
 * an advertisement for a feature the operator declined.
 *
 * So every sentence about anything leaving this instance is behind
 * `dataSharingConsents` AND a purpose the server says is actually offerable,
 * and every sentence about counting is behind `personaAnalytics`. Both gates
 * are asserted by a rendered-output word list in
 * `components/__tests__/profileQuestionsPage.test.ts`, not by inspection.
 *
 * `deferredPurposes` is deliberately NOT rendered here, although the payload
 * carries it and `/settings/privacy` does render it. Naming a purpose that is
 * not offered is the right call on the privacy dashboard, where a member is
 * reading about sharing and the silence would be ambiguous. Here it would be
 * the makerspace failure exactly: "recruiter sharing is off" still teaches
 * somebody answering a question about a bandsaw that recruiters are in this
 * software.
 *
 * ---------------------------------------------------------------------------
 * ANTI-BUNDLING
 * ---------------------------------------------------------------------------
 * The sharing control issues its OWN request to its OWN endpoint, and the
 * per-section Save touches no consent surface of any kind. They are separate
 * blocks with separate headings and no button does both. Co-location is
 * context; a Save that also records a grant would be consent bundled into a
 * data write, which is not specific consent under Art. 4(11). Two tests pin it
 * from both directions: saving answers issues zero consent requests, and the
 * switch issues zero persona writes.
 *
 * The switch is also never rendered before its disclosure. Turning a purpose ON
 * requires the block naming what is sent, to whom, and what a withdrawal cannot
 * undo to be on screen with it, because the registry copy says "the people
 * named below" and a page with no names below would make that sentence false.
 * Turning it OFF is one click with the block already open, so refusing is never
 * harder than agreeing (Art. 7(3)).
 *
 * ---------------------------------------------------------------------------
 * STATISTICS ARE NOT A CONSENT, SO THEY ARE NOT A TOGGLE HERE
 * ---------------------------------------------------------------------------
 * Instance statistics run on legitimate interest with an objection right
 * (Art. 21), not on consent. `PERSONA_STATISTICS.basisNote` says so in the
 * registry's own words, and this page renders that note and points at Privacy,
 * where the objection is recorded. Putting an objection switch next to a
 * consent switch would present two different legal instruments as the same
 * control, which is the confusion this whole correction exists to remove.
 *
 * ---------------------------------------------------------------------------
 * ROUTES CONSUMED (each contract read before this caller was written)
 * ---------------------------------------------------------------------------
 * GET    /api/persona                     -> PersonaReadResponse. `requireFeature('persona')`,
 *                                            so a disabled feature 404s: never ask for it.
 * PUT    /api/persona                     -> `{ sectionKey, answers }`, one section.
 * DELETE /api/persona/retired/[fieldKey]  -> erases one retired field's rows.
 * GET    /api/consent/purposes            -> ConsentPurposesPayload. `requireFeature('dataSharingConsents')`.
 *                                            Offerable purposes only: both surviving purposes set
 *                                            `requiresRecipients`, so an instance that has declared no
 *                                            recipient returns an EMPTY `purposes` array. That is the
 *                                            signal this page gates on, and it comes from the server
 *                                            rather than from a client-side guess about recipients.
 * PUT    /api/consent/purposes            -> `{ purpose, grant, scopeDigest }`, `.strict()`, ONE purpose
 *                                            per request. There is no bulk endpoint and there will not
 *                                            be one. A stale digest answers 409 with
 *                                            `data: ScopeChangedErrorData`, which is never auto-retried.
 */
import { PERSONA_STATISTICS, personaFieldSink } from '@commonpub/persona';
import type { PersonaCompleteness, PersonaField, PersonaSection } from '@commonpub/persona';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `About you, ${useSiteName()}` });

/**
 * `statisticsEnabled` is the `personaAnalytics` flag alone because everything it
 * gates renders inside the `persona` branch of this template, so the condition
 * is `persona && personaAnalytics` exactly as `/settings/privacy` computes it.
 * Both flags matter: the rollup plugin and every aggregate route gate on both,
 * so with the second one off no total is ever computed and there is nothing
 * here to describe.
 */
const {
  persona: personaEnabled,
  dataSharingConsents: consentsEnabled,
  personaAnalytics: statisticsEnabled,
} = useFeatures();
const { show: toast } = useToast();
const { extract } = useApiError();

/* -------------------------------------------------------------------------- */
/* The questions                                                              */
/* -------------------------------------------------------------------------- */

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
}

/**
 * Structurally identical to `PersonaReadResponse` in
 * `layers/base/server/api/persona.get.ts`. The route module itself is NOT
 * imported: a page importing a server route pulls `@commonpub/server` into the
 * client bundle.
 *
 * `PersonaSection` and `PersonaCompleteness` ARE imported, from
 * `@commonpub/persona`, which the layer declares and which several of these
 * components already import at runtime. Hand-copying the field shape is what
 * left a `publicOnProfile?: boolean` on this page's local DTO after the flag was
 * renamed: a copy of a type cannot be renamed by the compiler, so it silently
 * described a key the server no longer sends. A type-only import is erased at
 * build and cannot drift.
 */
interface PersonaReadResponse {
  sections: PersonaSection[];
  /** The four storage partitions, without the retired block. */
  values: PersonaValuesDto;
  /** Values whose question is no longer in the schema. Top level, not nested. */
  retired: PersonaRetiredDto[];
  completeness: PersonaCompleteness;
}

type PersonaSectionAnswers = Record<string, string | string[] | null>;

const { data, pending, refresh } = await useFetch<PersonaReadResponse>('/api/persona', {
  // A disabled feature 404s server-side (`requireFeature`). Never ask for it.
  immediate: personaEnabled.value,
});

/**
 * THE MERGE IS A DELETION (R3.5).
 *
 * A field bound to a `users` column is not a question, it is the profile, and
 * `/settings/profile/basics` now edits every column the bridge can name
 * (`displayName`, `headline`, `location`, `pronouns`, `bio`, which is the whole
 * of `UserBridgeColumn`). Rendering it here as well would leave two editors for
 * one datum with nothing to tell a member they are the same answer, which is
 * how a job title ended up editable in two places and is the confusion this
 * merge exists to remove. Filtering is per FIELD and not per section, because
 * the built-in `basics` section mixes five column-bound fields with a real
 * question (`industry`) and dropping the section would drop the question.
 *
 * LINK FIELDS DELIBERATELY STAY. `/settings/profile/links` builds its input
 * list from the built-in platforms plus any key the member already has a value
 * for, so a platform an operator declared and this member has not filled in yet
 * has no input there. Dropping link fields here would make that platform
 * uneditable anywhere, which is a worse failure than a duplicate editor over
 * one shared storage. The sentence below says the two places are the same
 * answer rather than leaving a member to discover it.
 */
const sections = computed<PersonaSection[]>(() => {
  // Annotated rather than inferred: `useFetch`'s data ref widens to `any` under
  // `vue-tsc` here, so an unannotated `.map((section) => ...)` is an implicit
  // any that the strict config rejects and that a looser one would have let
  // through silently.
  const served: PersonaSection[] = data.value?.sections ?? [];
  return served
    .map((section: PersonaSection): PersonaSection => ({
      ...section,
      fields: section.fields.filter((f: PersonaField) => f.column === undefined),
    }))
    // A section left with nothing but layout is noise, so it goes entirely.
    .filter((section: PersonaSection) => section.fields.some((f: PersonaField) => f.type !== 'section'));
});

const retired = computed<PersonaRetiredDto[]>(() => data.value?.retired ?? []);

/**
 * The meter binds to the SSR'd DTO, never to a `ref(0)` seed. A false zero in
 * first paint is a lie in the HTML, not merely a hydration warning; `null` makes
 * the meter render its own busy state instead of a number nobody measured.
 */
const completeness = computed<PersonaCompleteness | null>(() => data.value?.completeness ?? null);

/**
 * Has this member answered anything ON THIS PAGE?
 *
 * NOT `completeness.filledFields`, which counts the whole profile including the
 * column-bound fields this page no longer renders. A display name typed during
 * registration would make that number non-zero and silently suppress the empty
 * state on a page where nothing at all has been answered, which is the "SSR
 * zero-seed" failure pointed the other way: a true number about the wrong
 * question.
 */
const answered = computed<boolean>(() =>
  sections.value.some((section) => Object.keys(sectionValues(section)).length > 0));

/** Every field this page actually renders, flattened. */
const renderedFields = computed<PersonaField[]>(() =>
  sections.value.flatMap((section) => section.fields));

/**
 * The questions whose answers the operator has opted onto the public profile.
 *
 * Derived from the schema this member was actually served, so the sentence
 * below names the real fields rather than restating a default. After the
 * `showOnProfile` inversion the usual answer is NONE, and a page that stayed
 * silent about that would leave a member assuming the old behaviour: that
 * answering a question publishes it. Absent and `false` both mean private;
 * only `true` opts a field in, which is why the test is `=== true`.
 *
 * The three exclusions MIRROR `GET /api/users/:username/persona`, which is the
 * route that decides this, and they were read there rather than assumed: a
 * `sensitive` field is never published whatever the flag says, and a field
 * whose sink is `links` is skipped by that route because the profile hero
 * already prints it. `personaFieldSink` is the storage authority, so a
 * `sensitive` link field lands in the text sink and is correctly treated as
 * private here too.
 *
 * ONE HONEST GAP: that route also drops a field with schema drift, and
 * `/api/persona` does not carry drift (it is operator information). So a
 * drifted field can be named here and not appear there. The error runs toward
 * claiming MORE is visible than is, which is the safe direction for a sentence
 * a member decides what to type against.
 */
const publicFieldLabels = computed<string[]>(() =>
  renderedFields.value
    .filter((f) => f.showOnProfile === true
      && f.sensitive !== true
      && personaFieldSink(f) !== 'links')
    .map((f) => f.label));

/**
 * Link fields rendered here, which are on the profile whatever `showOnProfile`
 * says: they are stored in `users.social_links` and the hero has printed them
 * as its icon row since before persona existed. Claiming they are private
 * would be the one flatly false sentence this page could carry.
 */
const linkFieldLabels = computed<string[]>(() =>
  renderedFields.value.filter((f) => personaFieldSink(f) === 'links').map((f) => f.label));

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
function sectionValues(section: PersonaSection): Record<string, string | string[]> {
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

/**
 * ONE section, to ONE endpoint. This function is the whole of what Save does.
 * There is no consent call on this path, in either direction, and the test that
 * fails if one appears counts requests rather than reading this comment.
 */
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

/* -------------------------------------------------------------------------- */
/* The one sharing decision, when the operator has configured one             */
/* -------------------------------------------------------------------------- */

/** Mirrors `ConsentPurposeRecipient` in `server/api/consent/purposes.get.ts`. */
interface RecipientDto {
  id: string;
  name: string;
  privacyPolicyUrl: string;
  relationship: 'processor' | 'joint_controller' | 'independent_controller';
}

/**
 * Mirrors `ConsentPurposeCard`, minus the fields this compact surface does not
 * render. Every string rendered here comes from the payload, which the server
 * reads from the purpose registry: this page paraphrases no purpose, so its
 * wording cannot drift from what `/settings/privacy` shows or from what the
 * stored Art. 7(1) snapshot records as having been displayed.
 */
interface PurposeDto {
  id: string;
  label: string;
  /** What is true while it is OFF. Rendered before what would change. */
  offSummary: string;
  onSummary: string;
  revocationEffect: string;
  recipients: RecipientDto[];
  state: 'granted' | 'revoked' | 'absent';
  /** True only for a STALE grant, which authorises nothing. */
  needsReconfirmation: boolean;
}

interface ConsentPurposesResponse {
  /** The digest a subsequent PUT must echo back. */
  scopeDigest: string;
  purposes: PurposeDto[];
}

const { data: consentData, refresh: refreshConsent } = await useFetch<ConsentPurposesResponse>(
  '/api/consent/purposes',
  // Both gates, for two different reasons: the route is `requireFeature`d on
  // `dataSharingConsents` and 404s without it, and with `persona` off there are
  // no answers for a recipient to receive, so the question is moot.
  { immediate: personaEnabled.value && consentsEnabled.value },
);

/**
 * The purposes this instance can actually offer.
 *
 * Empty is the makerspace case and it is load bearing: both purposes require a
 * declared recipient, so an operator who turned the consent flag on but named
 * nobody gets no sharing block at all rather than a switch over a disclosure to
 * nobody. The emptiness is the server's decision, not a client guess about the
 * recipient list.
 */
const purposeCards = computed<PurposeDto[]>(() =>
  (consentsEnabled.value ? consentData.value?.purposes ?? [] : []));

const sharingOffered = computed<boolean>(() => purposeCards.value.length > 0);

const scopeDigest = computed<string>(() => consentData.value?.scopeDigest ?? '');

const busyPurpose = ref<string | null>(null);
const expandedPurpose = ref<string | null>(null);
const scopeMoved = ref<Record<string, true>>({});

/**
 * A switch is ON only when the server says a grant is CURRENTLY authorised.
 * `state === 'granted'` alone is not enough: a stale grant authorises nothing,
 * and rendering it as on would claim something is being disclosed that the
 * directory's own consent join has already stopped disclosing.
 */
function isOn(purpose: PurposeDto): boolean {
  return purpose.state === 'granted' && !purpose.needsReconfirmation;
}

/** The current truth, in the registry's words. Never a paraphrase. */
function statusLine(purpose: PurposeDto): string {
  return isOn(purpose) ? purpose.onSummary : purpose.offSummary;
}

/**
 * The disclosure block is open whenever the switch is reachable, and the switch
 * lives inside it. While a purpose is ON the block is open unconditionally, so
 * withdrawing is one click on a control that is already on screen.
 */
function isDisclosed(purpose: PurposeDto): boolean {
  return isOn(purpose) || expandedPurpose.value === purpose.id;
}

function toggleDisclosure(purpose: PurposeDto): void {
  expandedPurpose.value = expandedPurpose.value === purpose.id ? null : purpose.id;
}

function purposeLabelId(purpose: PurposeDto): string {
  return `cpub-questions-purpose-${purpose.id}`;
}

function purposeStatusId(purpose: PurposeDto): string {
  return `cpub-questions-purpose-status-${purpose.id}`;
}

function purposeDetailId(purpose: PurposeDto): string {
  return `cpub-questions-purpose-detail-${purpose.id}`;
}

/**
 * Verbatim from `/settings/privacy`. A recipient described one way on one
 * surface and another way on the other is the drift the registry copy exists to
 * prevent, and these three sentences are the only strings on this page that the
 * payload does not carry.
 */
const relationshipLabels: Record<RecipientDto['relationship'], string> = {
  processor: 'acts only on the instructions of this site',
  joint_controller: 'decides jointly with this site how your data is used',
  independent_controller: 'decides on its own how your data is used',
};

/**
 * One request, one purpose, one direction. Nothing about the questions is sent
 * with it and nothing about it is sent with a section save.
 *
 * A 409 means the disclosure moved while this page was open. Nothing is
 * recorded, nothing is retried, and this compact surface does not attempt to
 * render the diff: the honest answer to "what you were shown is out of date" is
 * to send the reader to the full card rather than to re-ask beside a summary
 * that is now the stale one.
 */
async function setPurpose(purpose: PurposeDto, grant: boolean): Promise<void> {
  busyPurpose.value = purpose.id;
  try {
    await $fetch('/api/consent/purposes', {
      method: 'PUT',
      body: { purpose: purpose.id, grant, scopeDigest: scopeDigest.value },
    });
    await refreshConsent();
    scopeMoved.value = omitKey(scopeMoved.value, purpose.id);
    // A withdrawal collapses the block it was clicked in, because the block is
    // open while the purpose is on. Keep it open so the member sees the new
    // status line where the switch was, rather than watching the surface they
    // just acted on disappear.
    if (!grant) expandedPurpose.value = purpose.id;
    toast(grant ? 'Turned on' : 'Turned off', 'success');
  } catch (err: unknown) {
    if (isScopeChanged(err)) {
      scopeMoved.value = { ...scopeMoved.value, [purpose.id]: true };
      await refreshConsent();
      return;
    }
    toast(extract(err), 'error');
  } finally {
    busyPurpose.value = null;
  }
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** The 409 body is one level deeper than it looks: h3 nests `createError({ data })`. */
function isScopeChanged(err: unknown): boolean {
  const e = err as { statusCode?: number; data?: { data?: { code?: string }; code?: string } };
  if (e?.statusCode !== 409) return false;
  return (e.data?.data?.code ?? e.data?.code) === 'SCOPE_CHANGED';
}

function toggle(purpose: PurposeDto): void {
  void setPurpose(purpose, !isOn(purpose));
}

/* -------------------------------------------------------------------------- */
/* Statistics: disclosed, never asked                                         */
/* -------------------------------------------------------------------------- */

/**
 * The registry's own words, imported rather than restated. The label and the
 * basis note are true whatever this member has decided, so this surface needs
 * no objection state and asks the objection endpoint nothing: the switch itself
 * belongs on Privacy, beside the rest of the record.
 */
const statisticsLabel = PERSONA_STATISTICS.label;
const statisticsBasisNote = PERSONA_STATISTICS.basisNote;
</script>

<template>
  <div class="cpub-questions-page">
    <h2 class="cpub-section-title-lg">About you</h2>

    <p v-if="!personaEnabled" class="cpub-questions-note">
      These questions are not enabled on this site.
    </p>

    <template v-else>
      <!--
        One lede, spaced as a group. These three sentences answer "what is this
        page", "who sees it" and "where is the rest of my profile", and a reader
        takes them together. The optionality clause that used to end the first
        sentence is gone: the meter below says it, the empty state said it, and
        five restatements of "this is optional" on one page is not reassurance,
        it is noise.
      -->
      <div class="cpub-questions-lede">
        <p class="cpub-questions-intro">
          These are the questions this site asks. You can change or clear any answer later.
        </p>

      <!--
        The visibility sentence, derived from the schema this member was served.
        After the inversion an answer is private unless the operator opted its
        field in, and saying which fields those are is the difference between a
        rule and a fact somebody can check.
      -->
        <p v-if="sections.length" class="cpub-questions-note">
          <template v-if="publicFieldLabels.length">
            These answers appear on your public profile: {{ publicFieldLabels.join(', ') }}. Every
            other answer here is seen only by you and the people who run this site.
          </template>
          <template v-else>
            Your answers here are seen only by you and the people who run this site. None of them
            appear on your public profile.
          </template>
        </p>

        <p class="cpub-questions-note">
          Your name, photo and bio are on the
          <NuxtLink to="/settings/profile/basics" class="cpub-questions-link">Basics</NuxtLink> tab.
        <!--
          Said out loud rather than left to be discovered. A link answered here
          and on the Links tab is ONE stored value, and a member who finds the
          same field twice with no explanation reasonably concludes one of them
          is not working.
        -->
          <template v-if="linkFieldLabels.length">
            The links you list are shown on your profile, like the rest of it, and they are also on
            the
            <NuxtLink to="/settings/profile/links" class="cpub-questions-link">Links</NuxtLink> tab.
            Changes made in either place are the same answer.
          </template>
        </p>
      </div>

      <!--
        THE ONE DECISION, and only where there is one to make. Rendered above the
        questions because it is context for answering them, and in its own block
        with its own heading because nothing here may be reachable from a Save.
      -->
      <section
        v-if="sharingOffered"
        class="cpub-questions-sharing"
        aria-labelledby="cpub-questions-sharing-heading"
      >
        <h3 id="cpub-questions-sharing-heading" class="cpub-questions-subhead">
          Who can find you by these answers
        </h3>

        <article v-for="purpose in purposeCards" :key="purpose.id" class="cpub-questions-purpose">
          <h4 :id="purposeLabelId(purpose)" class="cpub-questions-purpose-title">
            {{ purpose.label }}
          </h4>

          <!-- The current truth, before anything that would change it. -->
          <p :id="purposeStatusId(purpose)" class="cpub-questions-purpose-status">
            {{ statusLine(purpose) }}
          </p>

          <p v-if="scopeMoved[purpose.id]" class="cpub-questions-purpose-moved" role="status">
            What this covers changed while this page was open, so nothing has been recorded. Read
            the full details on the
            <NuxtLink to="/settings/privacy" class="cpub-questions-link">Privacy</NuxtLink> page and
            make your choice there.
          </p>

          <!--
            A real button toggling a real region: not `<details>`, whose open
            state cannot be driven from outside, and not a div with a role.
            Only offered while the purpose is off, because while it is on the
            block below is already open and the switch is already reachable.

            The region is v-if'd rather than kept in the DOM behind `hidden`,
            which is where this diverges from `PersonaSectionEditor`, and
            deliberately: what is hidden there is a form input, and what would be
            hidden here is a consent control. A grant switch that exists in the
            document before its disclosure has been read is exactly the thing
            this layout is arranged to prevent, so `aria-controls` is bound only
            while its target exists rather than left dangling at an absent id.
          -->
          <button
            v-if="!isOn(purpose)"
            type="button"
            class="cpub-questions-purpose-more"
            :aria-expanded="isDisclosed(purpose) ? 'true' : 'false'"
            :aria-controls="isDisclosed(purpose) ? purposeDetailId(purpose) : undefined"
            @click="toggleDisclosure(purpose)"
          >
            {{ isDisclosed(purpose) ? 'Hide what this means' : 'What turning this on means' }}
          </button>

          <div
            v-if="isDisclosed(purpose)"
            :id="purposeDetailId(purpose)"
            class="cpub-questions-purpose-detail"
          >
            <p v-if="!isOn(purpose)" class="cpub-questions-purpose-on">{{ purpose.onSummary }}</p>

            <div v-if="purpose.recipients.length" class="cpub-questions-recipients">
              <p class="cpub-questions-recipients-lead">Sent to:</p>
              <ul class="cpub-questions-recipient-list">
                <li v-for="recipient in purpose.recipients" :key="recipient.id">
                  <span class="cpub-questions-recipient-name">{{ recipient.name }}</span>
                  <span class="cpub-questions-recipient-rel">
                    {{ relationshipLabels[recipient.relationship] }}
                  </span>
                  <a
                    class="cpub-questions-link"
                    :href="recipient.privacyPolicyUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy policy for {{ recipient.name }}
                  </a>
                </li>
              </ul>
            </div>

            <!--
              The honest sentence, in full, in both directions. It says what a
              withdrawal cannot undo, and it is here before the switch rather
              than after it.
            -->
            <p class="cpub-questions-purpose-revocation">{{ purpose.revocationEffect }}</p>

            <div class="cpub-questions-purpose-actions">
              <button
                type="button"
                role="switch"
                class="cpub-questions-switch"
                :aria-checked="isOn(purpose) ? 'true' : 'false'"
                :aria-labelledby="purposeLabelId(purpose)"
                :aria-describedby="purposeStatusId(purpose)"
                :disabled="busyPurpose === purpose.id"
                @click="toggle(purpose)"
              >
                <span class="cpub-questions-switch-track" aria-hidden="true">
                  <span class="cpub-questions-switch-thumb"></span>
                </span>
                <span class="cpub-questions-switch-text">{{ isOn(purpose) ? 'On' : 'Off' }}</span>
              </button>
              <span class="cpub-questions-purpose-state">
                {{ isOn(purpose) ? 'Turn this off at any time.' : 'This is off.' }}
              </span>
            </div>
          </div>
        </article>

        <p class="cpub-questions-note">
          Who has looked you up, and every choice you have made here, are on the
          <NuxtLink to="/settings/privacy" class="cpub-questions-link">Privacy</NuxtLink> page.
        </p>
      </section>

      <!--
        Whole-profile, and named so: the DTO counts the fields on the Basics and
        Links tabs too, because the profile is what the tabs add up to. Its own
        accessible name is "Profile completeness", which is the honest one for a
        figure that is not about this tab alone.
      -->
      <PersonaCompletenessMeter :completeness="completeness" />

      <p v-if="pending && !sections.length" class="cpub-questions-note" aria-busy="true">
        Loading your answers...
      </p>

      <p v-else-if="!sections.length" class="cpub-questions-note">
        There is nothing to fill in on this site yet.
      </p>

      <!-- "Answer whatever you want to answer. You can change it at any time."
           is deleted, not moved: the meter directly above already says the
           whole thing is optional and that answers can be left. -->
      <p v-else-if="!answered" class="cpub-questions-note">
        Nothing here yet.
      </p>

      <div class="cpub-questions-sections">
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

      <!--
        Disclosed, not asked, and placed after the questions rather than above
        them: it is a statement about what this site does with its own records,
        not a decision the member has to take before answering anything.
      -->
      <section
        v-if="statisticsEnabled"
        class="cpub-questions-statistics"
        aria-labelledby="cpub-questions-statistics-heading"
      >
        <h3 id="cpub-questions-statistics-heading" class="cpub-questions-subhead">
          {{ statisticsLabel }}
        </h3>
        <p class="cpub-questions-note">{{ statisticsBasisNote }}</p>
        <p class="cpub-questions-note">
          What is counted, and how to object to it, are on the
          <NuxtLink to="/settings/privacy" class="cpub-questions-link">Privacy</NuxtLink> page.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* View-identity classes: every rule here is `cpub-questions-*` so a layout or
   copy change on this tab cannot reach the privacy dashboard's cards, which
   carry `cpub-purpose-*` and are a different surface with a different job. */
.cpub-questions-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
}

/* THE SPACING IS THE `gap` AND NOTHING ELSE.
   Without this reset the UA default `p { margin-block: 1em }` survives, and a
   flex container does NOT collapse margins, so every gap became
   `gap + 1em + 1em` with the em following each element's own font-size. That
   put six different gaps (32/44/56/57/77/92px) on one page, which is why the
   rhythm read as broken rather than as any single value being wrong.
   Scoped, so it stops at this page: the persona components set their own
   margins deliberately and must keep them. */
.cpub-questions-page :is(h2, h3, h4, p, ul) {
  margin: 0;
}

/* Two steps, not one. A heading and the lines it owns sit a `--space-2` apart;
   whole blocks sit a `--space-4` apart. Equal spacing everywhere is what made
   the page read as items floating rather than as groups, because proximity is
   the only signal that a heading belongs to the text under it. */
.cpub-questions-lede {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Measure. At 720px these paragraphs ran to ~96 characters a line, well past
   the 45-75 that stays comfortable, and this is the copy a member is least
   able to skim.

   52ch, not the usual 65ch, and every step of that was measured in a browser
   rather than reasoned about. `1ch` is the width of "0", which in this face is
   ~0.63em against an average character of ~0.49em, so a `ch` cap buys about a
   quarter more characters than its number suggests: 65ch rendered ~78 per line
   and 58ch still rendered ~74. 52ch renders ~65. `ch` is still the right unit
   because it tracks the font when an operator changes the family. */
.cpub-questions-intro,
.cpub-questions-note,
.cpub-questions-purpose-status,
.cpub-questions-purpose-on,
.cpub-questions-purpose-revocation {
  max-width: 52ch;
}

/* The meter's own bottom margin fought the page `gap` and won twice over,
   making the largest gap on the page. The page owns its rhythm; this is its
   only consumer. */
:deep(.cpub-persona-meter) {
  margin-bottom: 0;
}

.cpub-questions-intro {
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-questions-note {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-questions-link {
  /* `--accent-text`, not `--accent`: the raw accent is 2.53:1 on `--surface2`
     and 2.67:1 on `--bg` in the light theme, an outright AA failure for link
     text. `--accent-text` is the same hue mixed toward `--text` until it clears
     4.5:1, and it is the token this repo already uses for accent AS text. */
  color: var(--accent-text);
  text-decoration: underline;
}

.cpub-questions-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-questions-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* A prose card hugs its own measure. Capping the paragraphs but not the box
   left ~190px of empty card to the right of every line, which reads as a
   layout bug rather than as a column. Derived from the same 52ch the copy is
   capped at plus this card's own padding and border, so the two cannot drift
   apart when either is tuned. */
.cpub-questions-sharing,
.cpub-questions-statistics {
  max-width: calc(52ch + 2 * var(--space-4) + 2 * var(--border-width-default));
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
}

.cpub-questions-subhead {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.cpub-questions-purpose {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface2);
}

.cpub-questions-purpose-title {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--text);
}

.cpub-questions-purpose-status {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text);
}

.cpub-questions-purpose-on,
.cpub-questions-purpose-revocation {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-questions-purpose-moved {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text);
  padding: var(--space-2);
  border: var(--border-width-default) solid var(--yellow-border);
  background: var(--yellow-bg);
}

/* The disclosure control is a link-weight button, deliberately quieter than the
   switch it reveals: reading is not the decision. */
.cpub-questions-purpose-more {
  align-self: flex-start;
  min-height: 44px;
  padding: var(--space-2) 0;
  border: none;
  background: none;
  color: var(--accent-text);
  font-family: inherit;
  font-size: var(--text-sm);
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
}

.cpub-questions-purpose-more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-questions-purpose-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cpub-questions-recipients {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cpub-questions-recipients-lead {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.cpub-questions-recipient-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text);
}

.cpub-questions-recipient-name {
  font-weight: 600;
}

.cpub-questions-recipient-rel {
  color: var(--text-dim);
}

.cpub-questions-recipient-name,
.cpub-questions-recipient-rel {
  margin-right: var(--space-2);
}

.cpub-questions-purpose-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

/* The grant control and the withdrawal control are the same control, at the
   same size, in both directions. There is no smaller, lighter way to say no. */
.cpub-questions-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-2) var(--space-4);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.cpub-questions-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-questions-switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cpub-questions-switch[aria-checked='true'] {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.cpub-questions-switch-track {
  display: inline-flex;
  align-items: center;
  width: 34px;
  height: 18px;
  padding: 2px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-questions-switch[aria-checked='true'] .cpub-questions-switch-track {
  border-color: var(--accent);
  justify-content: flex-end;
}

.cpub-questions-switch-thumb {
  display: block;
  width: 12px;
  height: 12px;
  background: var(--text-dim);
}

.cpub-questions-switch[aria-checked='true'] .cpub-questions-switch-thumb {
  background: var(--accent);
}

.cpub-questions-purpose-state {
  font-size: var(--text-xs);
  color: var(--text-dim);
}
</style>
