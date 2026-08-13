<script setup lang="ts">
/**
 * /admin/persona-metrics — the operator audience dashboard (plan 7.3, 7.4, 8.5).
 *
 * The one surface that reads `GET /api/admin/persona-metrics`. Without it the
 * whole analytics half of this feature is unreachable: the rollup runs, the
 * public endpoints publish, and the operator who turned the flag on has no way
 * to see a single number.
 *
 * THE DASHBOARD GETS NO EXEMPTION, and this page is built to make that visible
 * rather than merely true. The route already applies the same consent inner
 * join, the same k-anonymity floors and the same downward quantisation as the
 * public API, so every number arriving here has already been suppressed and
 * floored. This page therefore does exactly three things with a number: prints
 * it, prints the quantum it was floored to, and prints the as-of it belongs to.
 * It never sums, never averages, never derives a percentage of anything, and
 * never renders a total or a population beyond the audience payload's own
 * quantised figure. `PersonaDistribution` deliberately carries no `total` key
 * (metrics.ts: "adding one is the differencing oracle"), and a denominator this
 * page computed for itself would reintroduce exactly that.
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
 *     -> { fields, distribution, distributions, links, audience, thresholds,
 *          quantum, asOf }
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

type PersonaUnavailableReason =
  | 'insufficient_population'
  | 'insufficient_bucket_diversity'
  | 'no_snapshot_yet'
  | 'purpose_not_offered';

type PersonaAudienceUnavailableReason =
  | 'purpose_not_offered'
  | 'insufficient_population'
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
  /** A bucket COUNT, never a person count. Never phrase it as people. */
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

interface PersonaAudienceCountsDto {
  sharingAnalytics: PersonaAudienceCountDto;
  openToRecruiters: PersonaAudienceCountDto;
  openToSponsorSharing: PersonaAudienceCountDto;
  quantum: number;
  available: boolean;
  reason?: PersonaUnavailableReason;
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
  thresholds: PersonaThresholdsDto;
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
const thresholds = computed<PersonaThresholdsDto | null>(() => data.value?.thresholds ?? null);

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
 * Small counts read as words in the agreed copy, and the agreed copy names
 * five because five is the default floor. An operator running `minBucket: 25`
 * must not be shown a sentence understating their own protection by five times,
 * which is the defect the consent copy already carries. So the number is
 * substituted, and it reads as the plan's exact string at the default.
 */
const NUMBER_WORDS: Record<number, string> = { 5: 'five' };
function peopleCount(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

const minBucket = computed(() => thresholds.value?.minBucket ?? 5);
const minPopulation = computed(() => thresholds.value?.minPopulation ?? 25);

/** Plan 8.5, admin dashboard, below the population floor. */
const POPULATION_COPY = computed(
  () =>
    'There are not enough people sharing statistics yet to show totals safely. ' +
    `Totals appear once at least ${minPopulation.value} people have turned sharing on.`,
);

/** Plan 8.5, admin dashboard, all buckets suppressed. */
const BUCKET_COPY = computed(
  () => `No answer has been chosen by at least ${peopleCount(minBucket.value)} people yet.`,
);

/** Plan 8.5 and 6.9, admin dashboard, no finalised day. */
const NO_SNAPSHOT_COPY =
  'Statistics are worked out once a day. The first set will appear after the next daily run.';

/** Plan 6.9, the suppression explainer, so an empty screen reads as working. */
const SUPPRESSION_COPY = computed(
  () =>
    `Answers are only shown as totals when at least ${peopleCount(minBucket.value)} people ` +
    'chose them, and totals are rounded. On a small instance most answers will be hidden. ' +
    'That is working correctly.',
);

function unavailableCopy(reason: PersonaUnavailableReason | undefined): string {
  switch (reason) {
    case 'insufficient_population':
      return POPULATION_COPY.value;
    case 'insufficient_bucket_diversity':
      return BUCKET_COPY.value;
    case 'no_snapshot_yet':
      return NO_SNAPSHOT_COPY;
    case 'purpose_not_offered':
      return 'Sharing choices are not offered on this site yet, so nothing is being counted.';
    default:
      return BUCKET_COPY.value;
  }
}

function audienceCopy(reason: PersonaAudienceUnavailableReason): string {
  switch (reason) {
    case 'purpose_not_offered':
      return 'Not offered on this site.';
    case 'insufficient_population':
      return POPULATION_COPY.value;
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
 * The plan copy says "rounded"; the implementation floors (`Math.floor`), so
 * this says rounded down. Never overstate a cohort an operator is about to make
 * a recruiting decision with.
 */
function provenance(p: Provenanced | null | undefined): string {
  if (!p) return '';
  const when =
    p.asOf === null
      ? 'Live reading, taken when this page loaded.'
      : `Daily snapshot for ${p.asOf} (UTC).`;
  return `${when} Counts are rounded down to the nearest ${p.quantum}.`;
}

/** A withheld-BUCKET count. Options, never people. */
function suppressedCopy(n: number): string {
  const each = peopleCount(minBucket.value);
  return n === 1
    ? `1 answer is hidden because fewer than ${each} people chose it.`
    : `${n} answers are hidden because fewer than ${each} people chose each one.`;
}

const AUDIENCE_ROWS = [
  {
    key: 'sharingAnalytics',
    label: 'Counted in community statistics',
    help: 'People who turned on sharing for group totals.',
  },
  {
    key: 'openToRecruiters',
    label: 'Open to recruiters',
    help: 'People open to being seen through the hiring directory.',
  },
  {
    key: 'openToSponsorSharing',
    label: 'Open to sharing with sponsors',
    help: 'People who agreed to their answers being shared with named sponsors.',
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
      <p class="cpub-audience-off-text">{{ SUPPRESSION_COPY }}</p>
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
            Group totals over the questions people chose to answer, counted only where
            someone turned sharing on.
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

      <!-- The explainer sits ABOVE the numbers, so an operator staring at an
           empty dashboard reads why before they read nothing. -->
      <div class="cpub-audience-note">
        <p class="cpub-audience-note-line">{{ SUPPRESSION_COPY }}</p>
        <p class="cpub-audience-note-line">
          This dashboard gets no exemption from those rules. It uses the same consent
          check, the same floors and the same rounding as the public API, because the
          agreement is with the member and not with the API.
        </p>
        <p v-if="thresholds" class="cpub-audience-note-line">
          Totals are hidden below {{ minBucket }} people in a single answer, and the
          whole screen stays dark below {{ minPopulation }} people sharing.
        </p>
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
              {{ unavailableCopy(audience?.reason) }}
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

              <p
                v-if="distribution?.available === true && distribution.suppressed > 0"
                class="cpub-audience-hint"
              >
                {{ suppressedCopy(distribution.suppressed) }}
              </p>

              <p class="cpub-audience-provenance">{{ provenance(distribution) }}</p>
            </template>
          </template>
        </section>

        <!-- ── Profile links ──────────────────────────────────────────── -->
        <section v-if="links" class="cpub-audience-card" aria-labelledby="cpub-audience-links">
          <h2 id="cpub-audience-links" class="cpub-audience-h2">Profile links</h2>
          <p class="cpub-audience-lede">
            How many people list a link on each platform. The addresses themselves are
            never counted or shown here.
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

            <p v-if="(links?.suppressed ?? 0) > 0" class="cpub-audience-hint">
              {{ suppressedCopy(links?.suppressed ?? 0) }}
            </p>

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
