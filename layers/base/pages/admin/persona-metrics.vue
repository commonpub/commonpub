<script setup lang="ts">
/**
 * /admin/persona-metrics — the operator audience dashboard (plan 7.3, 7.4, 8.5).
 *
 * The one surface that reads `GET /api/admin/persona-metrics`. Without it the
 * whole analytics half of this feature is unreachable: the rollup runs, the
 * public endpoints publish, and the operator who turned the flag on has no way
 * to see a single number.
 *
 * THESE NUMBERS ARE EXACT, AND THE PAGE HAS TO SAY SO (plan R3.4 phase 4). The
 * route applies no k-anonymity floor: the operator is the data controller,
 * holds the rows, and can already read every answer one profile at a time, so
 * suppression here prevented bulk convenience rather than access. An operator
 * who believes these totals are floored will read "20" as "somewhere between 20
 * and 24" and make a decision on a number that is not the one in front of them,
 * so the disclosure at the top of this screen is load bearing rather than
 * decorative, and so is the sentence saying what the PUBLIC API does instead.
 *
 * WHAT IS STILL TRUE. Members who objected to being counted are absent from
 * every number here, because an objection is an objection to being counted at
 * all rather than a request for coarser rounding. And this page still does
 * exactly three things with a number: prints it, prints its quantum, prints the
 * as-of it belongs to. It never sums, never averages, never derives a percentage
 * of anything, and never renders a total or a population beyond the audience
 * payload's own figure. `PersonaDistribution` deliberately carries no `total`
 * key (metrics.ts: "adding one is the differencing oracle"), and a denominator
 * this page computed for itself would reintroduce exactly that on the surface
 * whose numbers are now precise.
 *
 * The bar widths below are the only derived values, and they are derived from
 * the PUBLISHED counts against the largest published count. They disclose
 * nothing that is not already printed as text beside them, and they are
 * `aria-hidden`: every value is readable as text, and colour is never the only
 * encoding of anything.
 *
 * SELF-CONTAINED BY INSTRUCTION. No sub-component files, no shared components:
 * every piece is inline. That also sidesteps the auto-import prefix trap
 * (`components/persona/Foo.vue` registers as `<PersonaFoo>`, and a bare
 * `<Foo>` renders empty with no error).
 *
 * ROUTE CONTRACT, read from `layers/base/server/api/admin/persona-metrics.get.ts`
 * rather than assumed:
 *
 *   GET /api/admin/persona-metrics[?field=<key>][?fields=a,b,c][&limit=n]
 *     requireFeature('admin'), requireFeature('persona'),
 *     requireFeature('personaAnalytics'), requirePermission('audit.read')
 *     -> { fields, distribution, distributions, links, audience,
 *          publicThresholds, quantum, asOf }
 *
 * `publicThresholds` is NOT the floors in force here. It is what the public API
 * applies, carried so this page can state the difference in the operator's own
 * configured numbers. The key was renamed from `thresholds` for that reason: on
 * a payload that applies none, `thresholds` reads as the floors that were used.
 *
 * Two properties of that contract shape this page:
 *
 *  1. `distribution` is null unless `?field=` names ONE countable field, so
 *     this page selects a field and refetches: two round trips on first load
 *     (fields arrive, the first is selected, the query changes).
 *
 *     The route also accepts `?fields=a,b,c` and answers with `distributions[]`,
 *     and this page deliberately does NOT use it, because it would not save the
 *     round trip it looks like it saves: the field KEYS are themselves in the
 *     first response, so nothing can name them before it arrives. That parameter
 *     pays off only for a version of this screen that renders every field's
 *     answers at once instead of one behind a picker — a layout change, not a
 *     fetch change, and one nothing here has been able to see in a browser yet.
 *     Recorded so the next reader does not "fix" a picker into a batch fetch and
 *     find the round-trip count unchanged.
 *  2. `asOf` is ALWAYS null here, because the admin read is `source: 'live'` —
 *     a moment, not a finalised day. So `no_snapshot_yet` cannot arrive on this
 *     route today. Its copy is still wired, because plan 8.5 names it as one of
 *     this screen's three empty states and because the route's source is a
 *     one-word change away from being able to return it. An unreachable branch
 *     that prints the truth is cheaper than a missing branch that prints
 *     nothing.
 *
 * The DTO below is hand-declared rather than imported from the route module:
 * `persona-metrics.get.ts` imports `@commonpub/server`, and a type import from
 * a page is not always erased before bundling. `__tests__/persona-metrics.test.ts`
 * pins the route's real declaration text so this copy cannot drift silently.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Audience, Admin, ${useSiteName()}` });

// --- Route DTO (mirrors AdminPersonaMetricsResponse) -----------------------

/**
 * The DISTRIBUTION union. `purpose_not_offered` and `scope_changed` left it when
 * the statistics stopped being consent-gated: neither can describe a
 * distribution any more. `statistics_not_covered` arrived in their place, for a
 * class the statistics disclosure does not cover.
 */
type PersonaUnavailableReason =
  | 'insufficient_population'
  | 'insufficient_bucket_diversity'
  | 'no_snapshot_yet'
  | 'statistics_not_covered';

/** The AUDIENCE union, which is a different set because those counts are consent counts. */
type PersonaAudienceUnavailableReason =
  | 'purpose_not_offered'
  | 'insufficient_population'
  | 'scope_changed'
  | 'no_snapshot_yet';

interface PersonaOptionDto {
  value: string;
  label: string;
}

interface PersonaMetricsFieldDto {
  sectionKey: string;
  fieldKey: string;
  label: string;
  multiValued: boolean;
  options: ReadonlyArray<PersonaOptionDto>;
}

interface PersonaDistributionItemDto {
  value: string;
  label: string;
  count: number;
}

interface PersonaDistributionDto {
  field: string;
  label: string;
  items: PersonaDistributionItemDto[];
  /**
   * A bucket COUNT, never a person count, and ALWAYS 0 on this route: nothing is
   * withheld from an operator, so there is nothing to report as hidden.
   *
   * Kept on the DTO because it is on the wire and this type is the record of
   * what the route sends. It is deliberately not rendered: "0 answers are
   * hidden" on every load is noise, and a non-zero value here would mean the
   * route had quietly started applying a floor, which the disclosure at the top
   * of the screen says it does not.
   */
  suppressed: number;
  quantum: number;
  available: boolean;
  reason?: PersonaUnavailableReason;
  asOf: string | null;
}

interface PersonaLinkItemDto {
  platform: string;
  label: string;
  count: number;
  authenticitySignal: boolean;
}

interface PersonaLinkPresenceDto {
  items: PersonaLinkItemDto[];
  suppressed: number;
  quantum: number;
  available: boolean;
  reason?: PersonaUnavailableReason;
  asOf: string | null;
}

type PersonaAudienceCountDto =
  | { available: true; count: number }
  | { available: false; reason: PersonaAudienceUnavailableReason };

/**
 * Two slots, not three. `sharingAnalytics` went with the purpose behind it:
 * being counted is no longer a consent question, so there is no grant to count.
 */
interface PersonaAudienceCountsDto {
  openToRecruiters: PersonaAudienceCountDto;
  openToSponsorSharing: PersonaAudienceCountDto;
  quantum: number;
  available: boolean;
  reason?: PersonaAudienceUnavailableReason;
  asOf: string | null;
}

interface PersonaThresholdsDto {
  minBucket: number;
  minPopulation: number;
}

interface AdminPersonaMetricsResponseDto {
  fields: PersonaMetricsFieldDto[];
  distribution: PersonaDistributionDto | null;
  links: PersonaLinkPresenceDto;
  /** Null when `features.dataSharingConsents` is off: nobody COULD opt in. */
  audience: PersonaAudienceCountsDto | null;
  /** What the PUBLIC API applies. Nothing on this page was computed with it. */
  publicThresholds: PersonaThresholdsDto;
  /** 1 on this route, because these counts are exact. */
  quantum: number;
  asOf: null;
}

/** Anything carrying its own provenance. Both metric payloads qualify. */
interface Provenanced {
  asOf: string | null;
  quantum: number;
}

// --- Gates -----------------------------------------------------------------

const { persona: personaEnabled, personaAnalytics: analyticsEnabled } = useFeatures();
// `audit.read`, NOT `settings.manage`: the schema editor and this screen are
// deliberately different permissions, and a nav entry copied from the schema
// editor would show this link to an operator who then 403s.
const canAudit = useCan('audit.read');

const enabled = computed(
  () => personaEnabled.value && analyticsEnabled.value && canAudit.value,
);

// --- Data ------------------------------------------------------------------

const selectedField = ref<string | null>(null);

// A function value passed to `query` serialises to undefined; it has to be a
// computed, and it may only read refs declared ABOVE this call: the getter runs
// while `useFetch` builds the request, at which point `data` is still in its
// temporal dead zone. `server: false` because this is per-viewer,
// permission-gated data that has no business in the SSR payload.
const { data, pending, refresh, error } = useFetch<AdminPersonaMetricsResponseDto>(
  '/api/admin/persona-metrics',
  {
    query: computed(() => ({ field: selectedField.value ?? undefined })),
    server: false,
    immediate: enabled.value,
  },
);

/**
 * Seed the picker from the first response, so the operator lands on a real
 * breakdown rather than on a prompt.
 *
 * `distribution` is null unless the request named a field, so this costs one
 * extra round trip: fields arrive, the first is selected, the query changes,
 * the second response carries the breakdown. A `fields=` parameter on the route
 * would collapse that to one request; the route is not this page's to edit.
 *
 * A watcher rather than a computed, and the exception is stated rather than
 * assumed: seeding client state from a fetch inside `watch(..., immediate)` is
 * the recorded cause of hydration mismatches in this repo, and it cannot be one
 * here because `server: false` means the server renders no part of this data.
 */
watch(
  data,
  (value) => {
    if (selectedField.value !== null) return;
    const first = value?.fields[0]?.fieldKey;
    if (first !== undefined) selectedField.value = first;
  },
  { immediate: true },
);

const fields = computed<PersonaMetricsFieldDto[]>(() => data.value?.fields ?? []);
const distribution = computed<PersonaDistributionDto | null>(
  () => data.value?.distribution ?? null,
);
const links = computed<PersonaLinkPresenceDto | null>(() => data.value?.links ?? null);
const audience = computed<PersonaAudienceCountsDto | null>(() => data.value?.audience ?? null);
const publicThresholds = computed<PersonaThresholdsDto | null>(
  () => data.value?.publicThresholds ?? null,
);

const currentField = computed<PersonaMetricsFieldDto | null>(
  () => fields.value.find((f) => f.fieldKey === selectedField.value) ?? null,
);

/** Flattened for the template so no branch depends on narrowing a union there. */
const distributionItems = computed<PersonaDistributionItemDto[]>(
  () => distribution.value?.items ?? [],
);
const linkItems = computed<PersonaLinkItemDto[]>(() => links.value?.items ?? []);

function selectField(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  selectedField.value = value === '' ? null : value;
}

// --- Copy ------------------------------------------------------------------

/**
 * The floors THE PUBLIC API applies, substituted into the disclosure below.
 *
 * Never a hardcoded five. An operator running `minBucket: 25` must not be shown
 * a sentence understating their own published protection by five times, and the
 * fallbacks here are the package defaults rather than an invention, used only
 * before the first response arrives.
 */
const publicMinBucket = computed(() => publicThresholds.value?.minBucket ?? 5);
const publicMinPopulation = computed(() => publicThresholds.value?.minPopulation ?? 25);

/**
 * THE disclosure. Two sentences, both load bearing: what this screen is, and
 * what the published API does instead. An operator who reads a floored number as
 * exact makes a smaller mistake than one who reads an exact number as floored,
 * because the second silently widens every cohort they are about to act on.
 */
const UNSUPPRESSED_COPY =
  'These totals are exact and nothing here is hidden or rounded. You run this site, and ' +
  'every answer on this page is already yours to read one profile at a time.';

const PUBLIC_API_COPY = computed(
  () =>
    'The public statistics API is different. It leaves out any answer chosen by fewer than ' +
    `${publicMinBucket.value} people, rounds every total down to a multiple of ` +
    `${publicMinBucket.value}, and shows nothing at all below ${publicMinPopulation.value} people.`,
);

/**
 * The Art. 21 objection, stated where the numbers are read.
 *
 * An operator looking at a total needs to know it is a total over the people who
 * did not ask to be left out, because that is what makes the exclusion real
 * rather than a switch on a settings page nobody acts on.
 */
const OBJECTION_COPY =
  'People who asked not to be counted are not included in any total on this page.';

/** Nobody is counted on this instance at all. */
const POPULATION_COPY = 'There is nobody to count on this site yet.';

/** Nobody has answered the question in front of the operator. */
const BUCKET_COPY = 'Nobody has answered this question yet.';

/** Plan 8.5 and 6.9, no finalised day. */
const NO_SNAPSHOT_COPY =
  'Statistics are worked out once a day. The first set will appear after the next daily run.';

/**
 * Total coverage of the union, including the two members this route cannot
 * return today.
 *
 * `insufficient_bucket_diversity` needs a withheld bucket and nothing is
 * withheld here; `no_snapshot_yet` needs a rollup read and this one is live.
 * Both stay wired because the route is one word from being able to return
 * either, and an unreachable branch that prints the truth is cheaper than a
 * missing branch that prints nothing.
 */
function unavailableCopy(reason: PersonaUnavailableReason | undefined): string {
  switch (reason) {
    case 'insufficient_population':
      return POPULATION_COPY;
    case 'insufficient_bucket_diversity':
      return BUCKET_COPY;
    case 'no_snapshot_yet':
      return NO_SNAPSHOT_COPY;
    case 'statistics_not_covered':
      return 'The statistics on this site do not cover this, so nothing here is counted.';
    default:
      return BUCKET_COPY;
  }
}

/**
 * The WHOLE-SURFACE audience refusal, which is a different union from the
 * distribution one and no longer overlaps it.
 *
 * It used to call `unavailableCopy`, back when the two unions were the same set.
 * They are not: `scope_changed` can only describe a consent count, and
 * `statistics_not_covered` can only describe a distribution. Feeding one to the
 * other's switch would fall through to a default and print a sentence about a
 * different thing entirely.
 */
function audienceSurfaceCopy(reason: PersonaAudienceUnavailableReason | undefined): string {
  // The route always names one. A refusal that cannot say why is still a
  // refusal, and saying so beats printing a reason it does not have.
  if (reason === undefined) return 'These totals are not available right now.';
  return audienceCopy(reason);
}

function audienceCopy(reason: PersonaAudienceUnavailableReason): string {
  switch (reason) {
    case 'purpose_not_offered':
      return 'Not offered on this site.';
    case 'insufficient_population':
      return POPULATION_COPY;
    case 'scope_changed':
      return 'What is shared changed after these people agreed, so this total is not shown.';
    case 'no_snapshot_yet':
      return NO_SNAPSHOT_COPY;
  }
}

/**
 * THE line that must sit next to every published count.
 *
 * A number without its as-of invites an operator to read a stale snapshot as
 * live, and a number without its quantum invites them to read a floored count
 * as exact. Both travel together, from the payload's own fields rather than
 * from a page-level guess, so a section served from a different day or a
 * different floor says so.
 *
 * A quantum of 1 is not "rounded to the nearest 1", which reads as a rounding
 * rule where there is none. It says the counts are exact, in words, because that
 * is the fact an operator has to carry away from this screen.
 */
function provenance(p: Provenanced | null | undefined): string {
  if (!p) return '';
  const when =
    p.asOf === null
      ? 'Live reading, taken when this page loaded.'
      : `Daily snapshot for ${p.asOf} (UTC).`;
  const precision =
    p.quantum > 1 ? `Counts are rounded down to the nearest ${p.quantum}.` : 'Counts are exact.';
  return `${when} ${precision}`;
}

/**
 * Two rows, not three. The third was "Counted in community statistics", a count
 * of members holding a `profile_analytics` grant, and that purpose is gone:
 * being counted is not a consent question, so there is no grant to count and
 * nothing here would be a number about anybody's decision. What replaced it is
 * the objection sentence at the top of the screen.
 */
const AUDIENCE_ROWS = [
  {
    key: 'openToRecruiters',
    label: 'Open to recruiters',
    help: 'People who agreed to being found through the hiring directory.',
  },
  {
    key: 'openToSponsorSharing',
    label: 'Open to sharing with sponsors',
    help: 'People who agreed to their answers being sent to the sponsors you have named.',
  },
] as const;

/**
 * Flattened at the boundary, not narrowed in the template.
 *
 * `count` is null EXACTLY when the slot is unavailable, and the template renders
 * `note` in that case. A purpose nobody can grant must never render as 0: a zero
 * meaning "not implemented" reads identically to a zero meaning "nobody opted
 * in", which is the whole reason the payload is a discriminated union.
 */
interface AudienceRow {
  key: string;
  label: string;
  help: string;
  count: number | null;
  note: string | null;
}

const audienceRows = computed<AudienceRow[]>(() => {
  const a = audience.value;
  if (a === null) return [];
  return AUDIENCE_ROWS.map((row) => {
    const slot = a[row.key];
    return slot.available
      ? { key: row.key, label: row.label, help: row.help, count: slot.count, note: null }
      : { key: row.key, label: row.label, help: row.help, count: null, note: audienceCopy(slot.reason) };
  });
});

// --- Bars ------------------------------------------------------------------

/**
 * Bar width as a share of the LARGEST PUBLISHED count, never of a population.
 * `aria-hidden` in the template: the number beside it is the real content.
 */
function barWidth(count: number, all: ReadonlyArray<{ count: number }>): string {
  const max = all.reduce((m, i) => (i.count > m ? i.count : m), 0);
  if (max <= 0) return '0%';
  return `${Math.max(4, Math.round((count / max) * 100))}%`;
}
</script>

<template>
  <div class="cpub-audience">
    <!-- Flags first, permission second, and nothing below renders in either
         case: an operator without audit.read must not learn the field labels
         from a page shell that leaked them. -->
    <div v-if="!personaEnabled" class="cpub-audience-off">
      <h1 class="cpub-audience-title">Audience</h1>
      <p class="cpub-audience-off-text">
        The persona is not enabled on this instance. Turn on the
        <NuxtLink to="/admin/features">Persona feature flag</NuxtLink> first, then add
        some questions in the
        <NuxtLink to="/admin/persona">persona schema editor</NuxtLink>.
      </p>
    </div>

    <div v-else-if="!analyticsEnabled" class="cpub-audience-off">
      <h1 class="cpub-audience-title">Audience</h1>
      <p class="cpub-audience-off-text">
        Audience analytics are not enabled on this instance. Turn on the
        <NuxtLink to="/admin/features">Audience Analytics feature flag</NuxtLink> to
        count answers in group totals.
      </p>
    </div>

    <div v-else-if="!canAudit" class="cpub-audience-off">
      <h1 class="cpub-audience-title">Audience</h1>
      <p class="cpub-audience-off-text">
        You do not have permission to read audience statistics on this instance.
      </p>
    </div>

    <template v-else>
      <div class="cpub-audience-head">
        <div>
          <h1 class="cpub-audience-title">Audience</h1>
          <p class="cpub-audience-subtitle">
            Group totals over the questions your members answered, for you as the operator
            of this site.
          </p>
        </div>
        <button
          type="button"
          class="cpub-btn cpub-btn-sm"
          :disabled="pending"
          @click="refresh()"
        >
          <i :class="pending ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-rotate'"></i>
          Refresh
        </button>
      </div>

      <!-- The disclosure sits ABOVE the numbers, so nobody reads a total before
           they read what kind of total it is. -->
      <div class="cpub-audience-note">
        <p class="cpub-audience-note-line">{{ UNSUPPRESSED_COPY }}</p>
        <p v-if="publicThresholds" class="cpub-audience-note-line">{{ PUBLIC_API_COPY }}</p>
        <p class="cpub-audience-note-line">{{ OBJECTION_COPY }}</p>
      </div>

      <p v-if="pending && !data" class="cpub-audience-loading">Loading statistics.</p>

      <!-- The error text is deliberately generic. A stale field key in the
           picker makes the route 400 with the key in its message, and echoing a
           server message onto an operator screen is how a route's own wording
           becomes this page's contract. Refreshing re-reads the field list. -->
      <p v-else-if="error" role="alert" class="cpub-audience-empty">
        Statistics could not be loaded. Refresh to try again.
      </p>

      <template v-if="data">
        <!-- ── Who is sharing ─────────────────────────────────────────── -->
        <section class="cpub-audience-card" aria-labelledby="cpub-audience-people">
          <h2 id="cpub-audience-people" class="cpub-audience-h2">Who is sharing</h2>

          <p v-if="audience === null" class="cpub-audience-empty">
            Sharing choices are turned off, so nobody has been able to opt in. Turn on the
            <NuxtLink to="/admin/features">Data Sharing Consents feature flag</NuxtLink>
            to offer them.
          </p>

          <template v-else>
            <p v-if="audience?.available !== true" class="cpub-audience-empty">
              {{ audienceSurfaceCopy(audience?.reason) }}
            </p>

            <template v-else>
              <ul class="cpub-audience-rows">
                <li v-for="row in audienceRows" :key="row.key" class="cpub-audience-row">
                  <span class="cpub-audience-row-label">
                    {{ row.label }}
                    <span class="cpub-audience-row-help">{{ row.help }}</span>
                  </span>
                  <span v-if="row.count !== null" class="cpub-audience-row-count">
                    {{ row.count }} people
                  </span>
                  <span v-else class="cpub-audience-row-none">{{ row.note }}</span>
                </li>
              </ul>

              <p class="cpub-audience-provenance">{{ provenance(audience) }}</p>
            </template>
          </template>
        </section>

        <!-- ── Answers to one question ────────────────────────────────── -->
        <section class="cpub-audience-card" aria-labelledby="cpub-audience-answers">
          <h2 id="cpub-audience-answers" class="cpub-audience-h2">Answers</h2>

          <p v-if="fields.length === 0" class="cpub-audience-empty">
            No question on this profile can be counted yet. Add a choice question in the
            <NuxtLink to="/admin/persona">persona schema editor</NuxtLink>, and leave its
            statistics setting on.
          </p>

          <template v-else>
            <div class="cpub-audience-picker">
              <label class="cpub-audience-picker-label" for="cpub-audience-field">
                Question
              </label>
              <select
                id="cpub-audience-field"
                class="cpub-form-input"
                :value="selectedField ?? ''"
                @change="selectField"
              >
                <option v-for="f in fields" :key="f.fieldKey" :value="f.fieldKey">
                  {{ f.label }}
                </option>
              </select>
            </div>

            <p v-if="currentField?.multiValued" class="cpub-audience-hint">
              People can pick more than one answer here, so these totals do not add up to
              the number of people.
            </p>

            <p v-if="distribution === null" class="cpub-audience-empty">
              Pick a question to see how people answered it.
            </p>

            <template v-else>
              <p v-if="distribution?.available !== true" class="cpub-audience-empty">
                {{ unavailableCopy(distribution?.reason) }}
              </p>

              <p v-else-if="distributionItems.length === 0" class="cpub-audience-empty">
                {{ BUCKET_COPY }}
              </p>

              <ul v-else class="cpub-audience-bars">
                <li
                  v-for="item in distributionItems"
                  :key="item.value"
                  class="cpub-audience-bar-row"
                >
                  <span class="cpub-audience-bar-label">{{ item.label }}</span>
                  <span class="cpub-audience-bar-count">{{ item.count }} people</span>
                  <span class="cpub-audience-bar-track" aria-hidden="true">
                    <span
                      class="cpub-audience-bar-fill"
                      :style="{ width: barWidth(item.count, distributionItems) }"
                    ></span>
                  </span>
                </li>
              </ul>

              <p class="cpub-audience-provenance">{{ provenance(distribution) }}</p>
            </template>
          </template>
        </section>

        <!-- ── Profile links ──────────────────────────────────────────── -->
        <section v-if="links" class="cpub-audience-card" aria-labelledby="cpub-audience-links">
          <h2 id="cpub-audience-links" class="cpub-audience-h2">Profile links</h2>
          <p class="cpub-audience-lede">
            How many people list a link on each platform and have chosen to share it. The
            addresses themselves are never counted or shown here.
          </p>

          <p v-if="links?.available !== true" class="cpub-audience-empty">
            {{ unavailableCopy(links?.reason) }}
          </p>

          <p v-else-if="linkItems.length === 0" class="cpub-audience-empty">
            {{ BUCKET_COPY }}
          </p>

          <template v-else>
            <ul class="cpub-audience-bars">
              <li v-for="item in linkItems" :key="item.platform" class="cpub-audience-bar-row">
                <span class="cpub-audience-bar-label">
                  {{ item.label }}
                  <span v-if="item.authenticitySignal" class="cpub-audience-tag">
                    verified elsewhere
                  </span>
                </span>
                <span class="cpub-audience-bar-count">{{ item.count }} people</span>
                <span class="cpub-audience-bar-track" aria-hidden="true">
                  <span
                    class="cpub-audience-bar-fill"
                    :style="{ width: barWidth(item.count, linkItems) }"
                  ></span>
                </span>
              </li>
            </ul>

            <p class="cpub-audience-provenance">{{ provenance(links) }}</p>
          </template>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* Every colour, font and spacing value is a token. The audience-specific
   tokens live in packages/ui/theme/components.css under the persona block. */
.cpub-audience {
  max-width: 68rem;
}

.cpub-audience-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.cpub-audience-title {
  margin: 0 0 var(--space-1);
  font-size: var(--text-2xl);
  font-family: var(--font-sans);
  color: var(--text);
}

.cpub-audience-subtitle,
.cpub-audience-off-text,
.cpub-audience-lede {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-dim);
}

.cpub-audience-note {
  margin-bottom: var(--space-5);
  padding: var(--space-3) var(--space-4);
  background: var(--cpub-audience-note-bg);
  border: var(--border-width-default) solid var(--cpub-audience-note-border);
}

.cpub-audience-note-line {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text);
}

.cpub-audience-note-line:last-child {
  margin-bottom: 0;
}

.cpub-audience-loading {
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.cpub-audience-card {
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  background: var(--cpub-audience-card-bg);
  border: var(--border-width-default) solid var(--cpub-audience-card-border);
}

.cpub-audience-h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
}

.cpub-audience-empty {
  margin: 0;
  padding: var(--space-3) 0;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text);
}

.cpub-audience-hint {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  color: var(--text-dim);
}

/* Provenance is never smaller than the hint text: it is the sentence that stops
   a floored, day-old number being read as an exact live one. */
.cpub-audience-provenance {
  margin: var(--space-3) 0 0;
  padding-top: var(--space-2);
  border-top: var(--border-width-default) solid var(--cpub-audience-card-border);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.cpub-audience-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cpub-audience-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-bottom: var(--border-width-default) solid var(--cpub-audience-card-border);
}

.cpub-audience-row:last-child {
  border-bottom: none;
}

.cpub-audience-row-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-base);
  color: var(--text);
}

.cpub-audience-row-help {
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.cpub-audience-row-count {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  color: var(--text);
}

.cpub-audience-row-none {
  flex-shrink: 0;
  max-width: 22rem;
  text-align: right;
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.cpub-audience-picker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

/* 44px is the WCAG 2.1 AA target floor this repo holds itself to, and neither
   .cpub-form-input nor .cpub-input declares a height, so the control gets one
   here. Width is released from the class's 100% so the picker sits beside its
   label rather than filling the card. */
.cpub-audience-picker .cpub-form-input {
  width: auto;
  min-width: 16rem;
  max-width: 100%;
  min-height: 44px;
}

.cpub-audience-picker-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
}

.cpub-audience-bars {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Label and count on one line, the bar underneath spanning both. The bar is
   decoration: the count is already text, immediately after the label. */
.cpub-audience-bar-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-1) var(--space-3);
  padding: var(--space-2) 0;
}

.cpub-audience-bar-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
  font-size: var(--text-base);
  color: var(--text);
}

.cpub-audience-bar-count {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--text);
  white-space: nowrap;
}

.cpub-audience-bar-track {
  grid-column: 1 / -1;
  display: block;
  width: 100%;
  height: var(--cpub-audience-bar-height);
  background: var(--cpub-audience-bar-track-bg);
}

.cpub-audience-bar-fill {
  display: block;
  height: 100%;
  background: var(--cpub-audience-bar-fill-bg);
}

.cpub-audience-tag {
  padding: 0 var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
  border: var(--border-width-default) solid var(--cpub-audience-card-border);
}

@media (max-width: 640px) {
  .cpub-audience-head {
    flex-direction: column;
  }

  .cpub-audience-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .cpub-audience-row-none {
    max-width: none;
    text-align: left;
  }
}
</style>
