<script setup lang="ts">
/**
 * /admin/data-sharing — who receives members' data, and what they pulled.
 *
 * The CRUD the persona plan deferred and the member-visibility plan makes
 * required: a named recipient has to exist before an API key can bind to one,
 * and an unbound key reads nothing. Without this screen the whole directory is
 * configurable only by editing `commonpub.config.ts` and redeploying.
 *
 * THIS IS A COMPLIANCE SURFACE, NOT A FORM. The difference is the whole design
 * of the page. A bare form would let an operator fill in nine fields and press
 * Save without ever learning:
 *
 *  - that a joint or independent controller with no agreement reference makes
 *    its purpose unofferable for EVERY recipient covering that purpose, not
 *    just for itself, so one unpapered sponsor silently switches sponsor
 *    sharing off for the papered ones too;
 *  - that saving moves the consent scope digest, so everyone who already
 *    agreed is asked again before anything is disclosed;
 *  - that a recipient they wrote into the config file may have been dropped by
 *    the parser and is not in force at all;
 *  - that a purpose can be fully papered and still not be offered, because its
 *    read surface is not in this release yet.
 *
 * Every one of those is rendered inline, next to the thing it is about, and
 * every one of them is DERIVED from the route rather than declared twice here.
 * The route reads `offerable` from `currentPurposeScope`, which calls the real
 * `purposeIsOfferable`; this page only renders the explanation. A sentence here
 * can be wrong; the gate cannot be moved from here.
 *
 * SELF-CONTAINED BY INSTRUCTION. No sub-component files: every piece is inline.
 * That also sidesteps the auto-import prefix trap, where
 * `components/dataSharing/Foo.vue` registers as `<DataSharingFoo>` and a bare
 * `<Foo>` renders empty with no error.
 *
 * ROUTE CONTRACT, read from the handlers rather than assumed:
 *
 *   GET /api/admin/data-sharing/recipients
 *   PUT /api/admin/data-sharing/recipients   { recipients: [...] }
 *   GET /api/admin/data-sharing/disclosures?months=n
 *     requireFeature('admin'), requireFeature('persona'),
 *     requirePermission('settings.manage')
 *
 * The DTOs below are hand-declared rather than imported from the route modules:
 * those modules import `@commonpub/server`, and a type import from a page is not
 * always erased before bundling. `__tests__/data-sharing.test.ts` pins the
 * routes' real declaration text so these copies cannot drift silently.
 */
import { dataRecipientSchema } from '@commonpub/persona';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Data Sharing, Admin, ${useSiteName()}` });

// --- Route DTOs ------------------------------------------------------------

type ProcessingPurposeIdDto = 'profile_analytics' | 'recruiter_visibility' | 'sponsor_sharing';

type RelationshipDto = 'processor' | 'joint_controller' | 'independent_controller';

type TransferMechanismDto = 'adequacy' | 'scc' | 'bcr' | 'derogation';

type PurposeBlockerDto =
  | 'not_offered_in_release'
  | 'no_recipient'
  | 'unpapered_recipient'
  | 'no_countable_field';

interface RecipientDto {
  id: string;
  name: string;
  url?: string;
  privacyPolicyUrl: string;
  purposes: ProcessingPurposeIdDto[];
  relationship: RelationshipDto;
  agreementRef?: string;
  country?: string;
  transferMechanism?: TransferMechanismDto;
  source: 'config' | 'database';
  shadowedByConfig: boolean;
  unpapered: boolean;
}

interface DroppedEntryDto {
  index: number;
  id: string | null;
  error: string;
}

interface PurposeDto {
  id: ProcessingPurposeIdDto;
  label: string;
  offerable: boolean;
  blocker: PurposeBlockerDto | null;
  requiresRecipients: boolean;
  requiresAggregatableField: boolean;
  recipientIds: string[];
}

interface RecipientsResponseDto {
  configRecipients: RecipientDto[];
  storedRecipients: RecipientDto[];
  configError: string | null;
  droppedConfigEntries: DroppedEntryDto[];
  purposes: PurposeDto[];
  offeredPurposes: ProcessingPurposeIdDto[];
  scopeDigest: string;
  policyVersion: string;
  maxStoredRecipients: number;
  disclosureRetentionYears: number;
  flags: { dataSharingConsents: boolean; memberDirectory: boolean };
}

interface RecipientsPutResponseDto {
  storedRecipients: RecipientDto[];
  cleared: boolean;
  previousScopeDigest: string;
  scopeDigest: string;
  grantsNeedReconfirmation: boolean;
}

interface DisclosureMonthCellDto {
  month: string;
  members: number;
  disclosures: number;
}

interface DisclosureRecipientRowDto {
  recipientId: string;
  name: string | null;
  removed: boolean;
  months: DisclosureMonthCellDto[];
  totalMembers: number;
  totalDisclosures: number;
  lastDisclosedAt: string | null;
}

interface DisclosuresResponseDto {
  months: string[];
  recipients: DisclosureRecipientRowDto[];
  since: string;
  monthsRequested: number;
  disclosureRetentionYears: number;
  empty: boolean;
}

// --- Gates -----------------------------------------------------------------

const { persona: personaEnabled } = useFeatures();
// `settings.manage`, the key all three routes enforce. Copying the audience
// dashboard's `audit.read` would show this screen to an operator who then 403s
// on every request it makes.
const canSettings = useCan('settings.manage');

const enabled = computed(() => personaEnabled.value && canSettings.value);

const toast = useToast();

// --- Data ------------------------------------------------------------------

// `server: false`: per-viewer, permission-gated configuration that has no
// business in the SSR payload.
const {
  data,
  pending,
  refresh,
  error: loadError,
} = useFetch<RecipientsResponseDto>('/api/admin/data-sharing/recipients', {
  server: false,
  immediate: enabled.value,
});

const disclosureMonths = ref(12);

const {
  data: disclosures,
  pending: disclosuresPending,
  refresh: refreshDisclosures,
  error: disclosuresError,
} = useFetch<DisclosuresResponseDto>('/api/admin/data-sharing/disclosures', {
  // A function value passed to `query` serialises to undefined; it has to be a
  // computed, and it may only read refs declared ABOVE this call.
  query: computed(() => ({ months: disclosureMonths.value })),
  server: false,
  immediate: enabled.value,
});

const configRecipients = computed<RecipientDto[]>(() => data.value?.configRecipients ?? []);
const purposes = computed<PurposeDto[]>(() => data.value?.purposes ?? []);
const droppedEntries = computed<DroppedEntryDto[]>(() => data.value?.droppedConfigEntries ?? []);
const maxStored = computed<number>(() => data.value?.maxStoredRecipients ?? 50);
const retentionYears = computed<number>(() => data.value?.disclosureRetentionYears ?? 2);

const purposeLabels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const p of purposes.value) out[p.id] = p.label;
  return out;
});

// --- Draft editor ----------------------------------------------------------

/**
 * The editable mirror of the DATABASE half.
 *
 * `key` is a local counter and not the recipient id, because the id is itself
 * an editable field: keying the list on it would remount every row (and blur
 * the input) on the first keystroke of a new recipient's id.
 */
interface RecipientDraft {
  key: number;
  id: string;
  name: string;
  url: string;
  privacyPolicyUrl: string;
  purposes: ProcessingPurposeIdDto[];
  relationship: RelationshipDto;
  agreementRef: string;
  country: string;
  transferMechanism: '' | TransferMechanismDto;
}

let nextKey = 1;

function toDraft(recipient: RecipientDto): RecipientDraft {
  nextKey += 1;
  return {
    key: nextKey,
    id: recipient.id,
    name: recipient.name,
    url: recipient.url ?? '',
    privacyPolicyUrl: recipient.privacyPolicyUrl,
    purposes: [...recipient.purposes],
    relationship: recipient.relationship,
    agreementRef: recipient.agreementRef ?? '',
    country: recipient.country ?? '',
    transferMechanism: recipient.transferMechanism ?? '',
  };
}

function blankDraft(): RecipientDraft {
  nextKey += 1;
  return {
    key: nextKey,
    id: '',
    name: '',
    url: '',
    privacyPolicyUrl: '',
    purposes: [],
    // 'processor' is the default because it is the only relationship that needs
    // no agreement reference, so the form starts in the state that is complete
    // with the fewest fields. It is not the safest guess and the copy says so.
    relationship: 'processor',
    agreementRef: '',
    country: '',
    transferMechanism: '',
  };
}

const drafts = ref<RecipientDraft[]>([]);
const dirty = ref(false);
const saving = ref(false);
const saveError = ref('');

/**
 * Seed the editor from the first response.
 *
 * A watcher rather than a computed, because these rows are edited in place. It
 * cannot cause a hydration mismatch, which is the recorded hazard of this
 * shape: `server: false` means the server renders no part of this data.
 *
 * It refuses to overwrite unsaved edits. A background refresh that silently
 * discarded a half-typed recipient list would be the worst bug this page could
 * have.
 */
watch(
  () => data.value?.storedRecipients,
  (stored) => {
    if (stored === undefined) return;
    if (dirty.value) return;
    drafts.value = stored.map(toDraft);
  },
  { immediate: true },
);

function markDirty(): void {
  dirty.value = true;
  saveError.value = '';
}

function addDraft(): void {
  drafts.value = [...drafts.value, blankDraft()];
  markDirty();
}

function removeDraft(key: number): void {
  drafts.value = drafts.value.filter((d) => d.key !== key);
  markDirty();
}

function togglePurpose(draft: RecipientDraft, purpose: ProcessingPurposeIdDto): void {
  const i = draft.purposes.indexOf(purpose);
  if (i >= 0) draft.purposes.splice(i, 1);
  else draft.purposes.push(purpose);
  markDirty();
}

function discardChanges(): void {
  dirty.value = false;
  saveError.value = '';
  drafts.value = (data.value?.storedRecipients ?? []).map(toDraft);
}

/** Empty strings become absent keys, so nothing is stored as `''`. */
function toPayload(draft: RecipientDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: draft.id.trim(),
    name: draft.name.trim(),
    privacyPolicyUrl: draft.privacyPolicyUrl.trim(),
    purposes: [...draft.purposes],
    relationship: draft.relationship,
  };
  if (draft.url.trim() !== '') payload.url = draft.url.trim();
  if (draft.agreementRef.trim() !== '') payload.agreementRef = draft.agreementRef.trim();
  if (draft.country.trim() !== '') payload.country = draft.country.trim();
  if (draft.transferMechanism !== '') payload.transferMechanism = draft.transferMechanism;
  return payload;
}

/**
 * Client-side validation through the SAME schema the server writes with.
 *
 * Not a second, looser copy of the rules: `dataRecipientSchema` is imported from
 * `@commonpub/persona`, so the message an operator reads while typing is the
 * message the write path would produce. The server still refuses independently;
 * this only means they find out before pressing Save rather than after.
 */
const draftErrors = computed<Record<number, string>>(() => {
  const out: Record<number, string> = {};
  const seen = new Map<string, number>();
  for (const draft of drafts.value) {
    const parsed = dataRecipientSchema.safeParse(toPayload(draft));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.map(String).join('.') ?? '';
      out[draft.key] = path === '' ? (issue?.message ?? 'Invalid') : `${path}: ${issue?.message ?? 'Invalid'}`;
      continue;
    }
    const id = parsed.data.id;
    const previous = seen.get(id);
    if (previous !== undefined) out[draft.key] = `id: "${id}" is already used above`;
    else seen.set(id, draft.key);
  }
  return out;
});

const hasDraftErrors = computed<boolean>(() => Object.keys(draftErrors.value).length > 0);
const overCap = computed<boolean>(() => drafts.value.length > maxStored.value);

/** Papered? Rendered from the draft, so the warning appears as it is typed. */
function isUnpapered(draft: RecipientDraft): boolean {
  return draft.relationship !== 'processor' && draft.agreementRef.trim() === '';
}

/** Purposes this draft claims, as labels, for the unpapered warning sentence. */
function draftPurposeLabels(draft: RecipientDraft): string {
  const labels = draft.purposes.map((p) => purposeLabels.value[p] ?? p);
  if (labels.length === 0) return 'the purposes you name below';
  return labels.join(', ');
}

async function save(): Promise<void> {
  if (hasDraftErrors.value || overCap.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const result = await $fetch<RecipientsPutResponseDto>(
      '/api/admin/data-sharing/recipients',
      { method: 'PUT', body: { recipients: drafts.value.map(toPayload) } },
    );
    dirty.value = false;
    if (result.grantsNeedReconfirmation) {
      toast.success(
        'Recipients saved. Everyone who already agreed will be asked again before anything is shared.',
      );
    } else {
      toast.success('Recipients saved.');
    }
    await refresh();
  } catch (err) {
    const e = err as { statusMessage?: string; data?: { message?: string } };
    saveError.value = e.data?.message || e.statusMessage || 'Recipients could not be saved.';
  } finally {
    saving.value = false;
  }
}

// --- Copy ------------------------------------------------------------------

const RELATIONSHIP_LABELS: Record<RelationshipDto, string> = {
  processor: 'Processor (acts only on your instructions)',
  joint_controller: 'Joint controller (decides jointly with you)',
  independent_controller: 'Independent controller (decides on its own)',
};

const TRANSFER_LABELS: Record<TransferMechanismDto, string> = {
  adequacy: 'Adequacy decision',
  scc: 'Standard contractual clauses',
  bcr: 'Binding corporate rules',
  derogation: 'Derogation',
};

function relationshipLabel(relationship: RelationshipDto): string {
  return RELATIONSHIP_LABELS[relationship];
}

function transferLabel(mechanism: TransferMechanismDto | undefined): string {
  return mechanism === undefined ? 'Not stated' : TRANSFER_LABELS[mechanism];
}

/**
 * Why a purpose is not offered, in the operator's terms.
 *
 * `unpapered_recipient` is the one that is genuinely surprising, so it says
 * plainly that the refusal is not scoped to the recipient that caused it.
 */
function blockerCopy(purpose: PurposeDto): string {
  switch (purpose.blocker) {
    case 'not_offered_in_release':
      return 'This site does not offer this choice to members yet. You can name recipients for it now, and they take effect when it is offered.';
    case 'no_recipient':
      return 'No recipient is named for this purpose, so members are not asked about it and nothing is shared.';
    case 'unpapered_recipient':
      return 'A recipient named for this purpose is a joint or independent controller with no agreement reference. That withdraws this purpose from every recipient named for it, not only from that one, so nothing is shared with anybody under it until the reference is filled in.';
    case 'no_countable_field':
      return 'No question on the member profile can be counted, so there is nothing to share under this purpose.';
    default:
      // Unreachable while `blocker` is non-null exactly when `offerable` is
      // false, and rendered anyway: an empty paragraph under a "Not offered"
      // pill would read as a page bug rather than as a missing explanation.
      return 'This purpose is not offered to members on this site.';
  }
}

/** The one sentence that has to be read before Save, not after. */
const DIGEST_WARNING =
  'Changing who receives member data asks everyone again. A choice somebody already made was made against the list they were shown, so it does not carry over to a list they have not seen. Nothing is shared with a new recipient until each member agrees to the new list.';

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <div class="cpub-sharing">
    <div v-if="!personaEnabled" class="cpub-sharing-off">
      <h1 class="cpub-sharing-title">Data sharing</h1>
      <p class="cpub-sharing-lede">
        The persona is not enabled on this instance. Turn on the
        <NuxtLink to="/admin/features">Persona feature flag</NuxtLink> first. Recipients
        are only meaningful once there is something to share.
      </p>
    </div>

    <div v-else-if="!canSettings" class="cpub-sharing-off">
      <h1 class="cpub-sharing-title">Data sharing</h1>
      <p class="cpub-sharing-lede">
        You do not have permission to manage settings on this instance.
      </p>
    </div>

    <template v-else>
      <!-- A div, not a <header>: this is a page heading block inside the admin
           layout, and a second banner landmark on the page is an axe violation
           and a duplicate landmark for anyone navigating by landmark. -->
      <div class="cpub-sharing-head">
        <div>
          <h1 class="cpub-sharing-title">Data sharing</h1>
          <p class="cpub-sharing-lede">
            The named parties that members' data may be disclosed to, and the record of
            what each of them has read. Nothing is disclosed to anyone here until a member
            agrees to it.
          </p>
        </div>
        <button type="button" class="cpub-sharing-btn" :disabled="pending" @click="refresh()">
          <i :class="pending ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-rotate'" aria-hidden="true"></i>
          Refresh
        </button>
      </div>

      <p v-if="pending && !data" class="cpub-sharing-loading">Loading recipients.</p>

      <p v-else-if="loadError" role="alert" class="cpub-sharing-alert cpub-sharing-alert-bad">
        Recipients could not be loaded. Refresh to try again.
      </p>

      <template v-if="data">
        <!-- The config file said something the parser refused ---------------- -->
        <div
          v-if="data.configError"
          role="alert"
          class="cpub-sharing-alert cpub-sharing-alert-bad"
        >
          <strong>The data sharing block in commonpub.config.ts could not be read.</strong>
          No recipient from the config file is in force, so no purpose that needs one is
          being offered. First problem found: <code>{{ data.configError }}</code>
        </div>

        <div
          v-if="droppedEntries.length > 0"
          role="alert"
          class="cpub-sharing-alert cpub-sharing-alert-bad"
        >
          <strong>
            {{ droppedEntries.length }} recipient{{ droppedEntries.length === 1 ? '' : 's' }} in
            commonpub.config.ts {{ droppedEntries.length === 1 ? 'was' : 'were' }} refused.
          </strong>
          A refused recipient is not in force and nothing is shared with it. Fix the file
          and redeploy.
          <ul class="cpub-sharing-dropped">
            <li v-for="entry in droppedEntries" :key="entry.index">
              <code>recipients[{{ entry.index }}]</code>
              <span v-if="entry.id"> (<code>{{ entry.id }}</code>)</span>:
              {{ entry.error }}
            </li>
          </ul>
        </div>

        <!-- ── Purposes ────────────────────────────────────────────────── -->
        <section class="cpub-sharing-card" aria-labelledby="cpub-sharing-purposes">
          <h2 id="cpub-sharing-purposes" class="cpub-sharing-h2">What can be shared</h2>
          <p class="cpub-sharing-note">
            A purpose is only offered to members once everything it needs is in place.
            This is the same check the privacy settings page makes, so a purpose listed as
            not offered here is a purpose no member can agree to.
          </p>

          <ul class="cpub-sharing-purposes">
            <li v-for="purpose in purposes" :key="purpose.id" class="cpub-sharing-purpose">
              <div class="cpub-sharing-purpose-head">
                <span class="cpub-sharing-purpose-label">{{ purpose.label }}</span>
                <span
                  class="cpub-sharing-pill"
                  :class="purpose.offerable ? 'cpub-sharing-pill-on' : 'cpub-sharing-pill-off'"
                >
                  {{ purpose.offerable ? 'Offered to members' : 'Not offered' }}
                </span>
              </div>
              <p v-if="!purpose.offerable" class="cpub-sharing-purpose-why">
                {{ blockerCopy(purpose) }}
              </p>
              <p class="cpub-sharing-purpose-meta">
                <template v-if="purpose.recipientIds.length > 0">
                  Named recipients: {{ purpose.recipientIds.join(', ') }}
                </template>
                <template v-else>No recipient is named for this purpose.</template>
              </p>
            </li>
          </ul>

          <p class="cpub-sharing-provenance">
            Consent record version {{ data.policyVersion }}, list fingerprint
            <code>{{ data.scopeDigest }}</code>. Members' agreements are recorded against
            this fingerprint.
          </p>
        </section>

        <!-- ── File declared ───────────────────────────────────────────── -->
        <section class="cpub-sharing-card" aria-labelledby="cpub-sharing-config">
          <h2 id="cpub-sharing-config" class="cpub-sharing-h2">Declared in commonpub.config.ts</h2>
          <p class="cpub-sharing-note">
            Read only here. These are under review in your source control, and they win if
            an entry below uses the same id. Change them in the file and redeploy.
          </p>

          <p v-if="configRecipients.length === 0" class="cpub-sharing-empty">
            No recipient is declared in the config file.
          </p>

          <ul v-else class="cpub-sharing-list">
            <li
              v-for="recipient in configRecipients"
              :key="recipient.id"
              class="cpub-sharing-item"
            >
              <div class="cpub-sharing-item-head">
                <span class="cpub-sharing-item-name">{{ recipient.name }}</span>
                <code class="cpub-sharing-item-id">{{ recipient.id }}</code>
              </div>
              <dl class="cpub-sharing-facts">
                <div class="cpub-sharing-fact">
                  <dt>Relationship</dt>
                  <dd>{{ relationshipLabel(recipient.relationship) }}</dd>
                </div>
                <div class="cpub-sharing-fact">
                  <dt>Purposes</dt>
                  <dd>
                    {{ recipient.purposes.map((p) => purposeLabels[p] ?? p).join(', ') }}
                  </dd>
                </div>
                <div class="cpub-sharing-fact">
                  <dt>Privacy policy</dt>
                  <dd>
                    <a :href="recipient.privacyPolicyUrl" rel="noopener noreferrer" target="_blank">
                      {{ recipient.privacyPolicyUrl }}
                    </a>
                  </dd>
                </div>
                <div class="cpub-sharing-fact">
                  <dt>Agreement reference</dt>
                  <dd>{{ recipient.agreementRef || 'Not stated' }}</dd>
                </div>
                <div class="cpub-sharing-fact">
                  <dt>Country</dt>
                  <dd>{{ recipient.country || 'Not stated' }}</dd>
                </div>
                <div class="cpub-sharing-fact">
                  <dt>Transfer basis</dt>
                  <dd>{{ transferLabel(recipient.transferMechanism) }}</dd>
                </div>
              </dl>
              <p v-if="recipient.unpapered" class="cpub-sharing-warn" role="note">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                This is a {{ recipient.relationship === 'joint_controller' ? 'joint' : 'independent' }}
                controller with no agreement reference, so nothing is offered to members
                under its purposes, for any recipient.
              </p>
            </li>
          </ul>
        </section>

        <!-- ── Editable ────────────────────────────────────────────────── -->
        <section class="cpub-sharing-card" aria-labelledby="cpub-sharing-stored">
          <h2 id="cpub-sharing-stored" class="cpub-sharing-h2">Added on this site</h2>
          <p class="cpub-sharing-note">
            Stored on this instance and editable without a deploy. At most
            {{ maxStored }}.
          </p>
          <p class="cpub-sharing-warn" role="note">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            {{ DIGEST_WARNING }}
          </p>

          <p v-if="drafts.length === 0" class="cpub-sharing-empty">
            No recipient has been added here. Nothing is shared with anyone outside this
            site.
          </p>

          <ul v-else class="cpub-sharing-list">
            <li v-for="(draft, index) in drafts" :key="draft.key" class="cpub-sharing-item">
              <fieldset class="cpub-sharing-fieldset">
                <legend class="cpub-sharing-legend">
                  {{ draft.name.trim() || 'New recipient' }}
                </legend>

                <div class="cpub-sharing-grid">
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-name-${draft.key}`">Name</label>
                    <input
                      :id="`cpub-recipient-name-${draft.key}`"
                      v-model="draft.name"
                      class="cpub-sharing-input"
                      type="text"
                      maxlength="120"
                      @input="markDirty"
                    />
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-id-${draft.key}`">Reference id</label>
                    <input
                      :id="`cpub-recipient-id-${draft.key}`"
                      v-model="draft.id"
                      class="cpub-sharing-input"
                      type="text"
                      maxlength="40"
                      :aria-describedby="`cpub-recipient-id-help-${draft.key}`"
                      @input="markDirty"
                    />
                    <p :id="`cpub-recipient-id-help-${draft.key}`" class="cpub-sharing-help">
                      Lower case letters, numbers, hyphen and underscore. An API key is
                      bound to this id, and every disclosure is recorded against it, so
                      changing it later loses the link to what has already been shared.
                    </p>
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-policy-${draft.key}`">Privacy policy URL</label>
                    <input
                      :id="`cpub-recipient-policy-${draft.key}`"
                      v-model="draft.privacyPolicyUrl"
                      class="cpub-sharing-input"
                      type="url"
                      maxlength="512"
                      :aria-describedby="`cpub-recipient-policy-help-${draft.key}`"
                      @input="markDirty"
                    />
                    <p :id="`cpub-recipient-policy-help-${draft.key}`" class="cpub-sharing-help">
                      Required. Members are shown this link before they agree, so a party
                      with no policy to link cannot be a recipient.
                    </p>
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-url-${draft.key}`">Website (optional)</label>
                    <input
                      :id="`cpub-recipient-url-${draft.key}`"
                      v-model="draft.url"
                      class="cpub-sharing-input"
                      type="url"
                      maxlength="512"
                      @input="markDirty"
                    />
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-relationship-${draft.key}`">Relationship</label>
                    <select
                      :id="`cpub-recipient-relationship-${draft.key}`"
                      v-model="draft.relationship"
                      class="cpub-sharing-input"
                      @change="markDirty"
                    >
                      <option value="processor">{{ RELATIONSHIP_LABELS.processor }}</option>
                      <option value="joint_controller">{{ RELATIONSHIP_LABELS.joint_controller }}</option>
                      <option value="independent_controller">{{ RELATIONSHIP_LABELS.independent_controller }}</option>
                    </select>
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-agreement-${draft.key}`">Agreement reference</label>
                    <input
                      :id="`cpub-recipient-agreement-${draft.key}`"
                      v-model="draft.agreementRef"
                      class="cpub-sharing-input"
                      type="text"
                      maxlength="512"
                      :aria-describedby="`cpub-recipient-agreement-help-${draft.key}`"
                      @input="markDirty"
                    />
                    <p :id="`cpub-recipient-agreement-help-${draft.key}`" class="cpub-sharing-help">
                      The signed instrument covering this transfer, as a URL or an internal
                      reference. Optional for a processor, required for anyone else.
                    </p>
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-country-${draft.key}`">Country (optional)</label>
                    <input
                      :id="`cpub-recipient-country-${draft.key}`"
                      v-model="draft.country"
                      class="cpub-sharing-input"
                      type="text"
                      maxlength="64"
                      @input="markDirty"
                    />
                  </div>
                  <div class="cpub-sharing-field">
                    <label :for="`cpub-recipient-transfer-${draft.key}`">Transfer basis (optional)</label>
                    <select
                      :id="`cpub-recipient-transfer-${draft.key}`"
                      v-model="draft.transferMechanism"
                      class="cpub-sharing-input"
                      @change="markDirty"
                    >
                      <option value="">Not stated</option>
                      <option value="adequacy">{{ TRANSFER_LABELS.adequacy }}</option>
                      <option value="scc">{{ TRANSFER_LABELS.scc }}</option>
                      <option value="bcr">{{ TRANSFER_LABELS.bcr }}</option>
                      <option value="derogation">{{ TRANSFER_LABELS.derogation }}</option>
                    </select>
                  </div>
                </div>

                <div class="cpub-sharing-field">
                  <span :id="`cpub-recipient-purposes-${draft.key}`" class="cpub-sharing-field-label">
                    Purposes
                  </span>
                  <div
                    class="cpub-sharing-purpose-choices"
                    role="group"
                    :aria-labelledby="`cpub-recipient-purposes-${draft.key}`"
                  >
                    <label
                      v-for="purpose in purposes"
                      :key="purpose.id"
                      class="cpub-sharing-choice"
                    >
                      <input
                        type="checkbox"
                        :checked="draft.purposes.includes(purpose.id)"
                        @change="togglePurpose(draft, purpose.id)"
                      />
                      <span>{{ purpose.label }}</span>
                    </label>
                  </div>
                </div>

                <p v-if="isUnpapered(draft)" class="cpub-sharing-warn" role="note">
                  <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                  A {{ draft.relationship === 'joint_controller' ? 'joint' : 'independent' }}
                  controller needs an agreement reference. Until you add one, this site will
                  not offer {{ draftPurposeLabels(draft) }} to members at all, including for
                  every other recipient named for the same purpose, so nothing is shared with
                  anybody under it.
                </p>

                <p v-if="draftErrors[draft.key]" class="cpub-sharing-error" role="alert">
                  {{ draftErrors[draft.key] }}
                </p>

                <div class="cpub-sharing-item-actions">
                  <button
                    type="button"
                    class="cpub-sharing-btn cpub-sharing-btn-danger"
                    :aria-label="`Remove recipient ${draft.name.trim() || index + 1}`"
                    @click="removeDraft(draft.key)"
                  >
                    Remove
                  </button>
                </div>
              </fieldset>
            </li>
          </ul>

          <p v-if="overCap" class="cpub-sharing-error" role="alert">
            At most {{ maxStored }} recipients can be stored here. Remove
            {{ drafts.length - maxStored }} before saving.
          </p>
          <p v-if="saveError" class="cpub-sharing-error" role="alert">{{ saveError }}</p>

          <div class="cpub-sharing-actions">
            <button type="button" class="cpub-sharing-btn" @click="addDraft">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Add recipient
            </button>
            <button
              type="button"
              class="cpub-sharing-btn"
              :disabled="!dirty || saving"
              @click="discardChanges"
            >
              Discard changes
            </button>
            <button
              type="button"
              class="cpub-sharing-btn cpub-sharing-btn-primary"
              :disabled="!dirty || saving || hasDraftErrors || overCap"
              @click="save"
            >
              {{ saving ? 'Saving...' : 'Save recipients' }}
            </button>
          </div>
        </section>

        <!-- ── Disclosure record ───────────────────────────────────────── -->
        <section class="cpub-sharing-card" aria-labelledby="cpub-sharing-disclosures">
          <h2 id="cpub-sharing-disclosures" class="cpub-sharing-h2">What has been read</h2>
          <p class="cpub-sharing-note">
            Members disclosed to each recipient, by month. People is the number of
            different members that recipient was shown. Reads is how many times they were
            shown, so a much larger reads figure means the same people are being pulled
            again and again.
          </p>
          <p class="cpub-sharing-note">
            Which members a recipient saw is that member's own record and is shown to them
            on their privacy settings, not here. Records are deleted after
            {{ retentionYears }} year{{ retentionYears === 1 ? '' : 's' }}.
          </p>

          <div class="cpub-sharing-picker">
            <label for="cpub-sharing-months">Months</label>
            <select
              id="cpub-sharing-months"
              v-model.number="disclosureMonths"
              class="cpub-sharing-input"
              @change="refreshDisclosures()"
            >
              <option :value="3">Last 3</option>
              <option :value="6">Last 6</option>
              <option :value="12">Last 12</option>
              <option :value="24">Last 24</option>
            </select>
          </div>

          <p v-if="disclosuresPending && !disclosures" class="cpub-sharing-loading">
            Loading the disclosure record.
          </p>
          <p
            v-else-if="disclosuresError"
            role="alert"
            class="cpub-sharing-alert cpub-sharing-alert-bad"
          >
            The disclosure record could not be loaded. Refresh to try again.
          </p>
          <p v-else-if="disclosures?.empty" class="cpub-sharing-empty">
            Nothing has been disclosed to anybody yet.
          </p>
          <div v-else-if="disclosures" class="cpub-sharing-table-wrap">
            <table class="cpub-sharing-table">
              <caption class="cpub-sharing-caption">
                Members disclosed per recipient per month
              </caption>
              <thead>
                <tr>
                  <th scope="col">Recipient</th>
                  <th scope="col">People</th>
                  <th scope="col">Reads</th>
                  <th scope="col">Last read</th>
                  <th v-for="month in disclosures.months" :key="month" scope="col">
                    {{ month }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in disclosures.recipients" :key="row.recipientId">
                  <th scope="row">
                    {{ row.name ?? row.recipientId }}
                    <span v-if="row.removed" class="cpub-sharing-pill cpub-sharing-pill-off">
                      no longer declared
                    </span>
                  </th>
                  <td>{{ row.totalMembers }}</td>
                  <td>{{ row.totalDisclosures }}</td>
                  <td>{{ fmtDate(row.lastDisclosedAt) }}</td>
                  <td v-for="cell in row.months" :key="cell.month">
                    {{ cell.members }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* Every colour, size and font is a token. No page-specific token block is
   declared in packages/ui/theme/components.css for this screen: it reaches only
   for tokens that already exist, so it adds no surface for a fork to override
   and nothing to keep in sync. */
.cpub-sharing {
  max-width: 72rem;
}

.cpub-sharing-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.cpub-sharing-title {
  margin: 0 0 var(--space-1);
  font-size: var(--text-2xl);
  font-family: var(--font-sans);
  color: var(--text);
}

.cpub-sharing-lede,
.cpub-sharing-note {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-dim);
  max-width: 62ch;
}

.cpub-sharing-loading,
.cpub-sharing-empty {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: var(--space-2) 0;
}

.cpub-sharing-card {
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
}

.cpub-sharing-h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
}

.cpub-sharing-alert {
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
}

.cpub-sharing-alert-bad {
  background: var(--red-bg);
  border-color: var(--red-border);
  color: var(--red-text);
}

.cpub-sharing-alert code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.cpub-sharing-dropped {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-4);
  font-size: var(--text-xs);
}

.cpub-sharing-purposes,
.cpub-sharing-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cpub-sharing-purpose {
  padding: var(--space-3) 0;
  border-top: var(--border-width-default) solid var(--border2);
}

.cpub-sharing-purpose:first-child {
  border-top: none;
}

.cpub-sharing-purpose-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cpub-sharing-purpose-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.cpub-sharing-purpose-why,
.cpub-sharing-purpose-meta {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-dim);
  max-width: 62ch;
}

.cpub-sharing-pill {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: 2px var(--space-2);
  border: var(--border-width-default) solid var(--border);
}

.cpub-sharing-pill-on {
  background: var(--green-bg);
  border-color: var(--green-border);
  color: var(--green-text);
}

.cpub-sharing-pill-off {
  background: var(--surface2);
  color: var(--text-dim);
}

.cpub-sharing-provenance {
  margin: var(--space-3) 0 0;
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.cpub-sharing-provenance code {
  font-family: var(--font-mono);
}

.cpub-sharing-item {
  padding: var(--space-3) 0;
  border-top: var(--border-width-default) solid var(--border2);
}

.cpub-sharing-item:first-child {
  border-top: none;
}

.cpub-sharing-item-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cpub-sharing-item-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.cpub-sharing-item-id {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-dim);
}

.cpub-sharing-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--space-2) var(--space-4);
  margin: var(--space-2) 0 0;
}

.cpub-sharing-fact dt {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
}

.cpub-sharing-fact dd {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text);
  overflow-wrap: anywhere;
}

.cpub-sharing-fact a {
  color: var(--color-link);
}

.cpub-sharing-warn {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3);
  background: var(--yellow-bg);
  border: var(--border-width-default) solid var(--yellow-border);
  color: var(--yellow-text);
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
}

.cpub-sharing-error {
  margin: var(--space-2) 0 0;
  font-size: var(--text-xs);
  color: var(--red-text);
}

.cpub-sharing-fieldset {
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
}

.cpub-sharing-legend {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  padding: 0;
}

.cpub-sharing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.cpub-sharing-field {
  margin-top: var(--space-3);
  min-width: 0;
}

.cpub-sharing-grid .cpub-sharing-field {
  margin-top: 0;
}

/* Direct child only. The purpose checkboxes are labels too, nested one level
   deeper inside `.cpub-sharing-purpose-choices`, and a descendant selector here
   would out-specify `.cpub-sharing-choice` and flatten every chip back to a
   block. (CSS cascade is the unit-test blind spot: jsdom has no layout, so this
   would have shipped green.) */
.cpub-sharing-field > label,
.cpub-sharing-field-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-1);
}

.cpub-sharing-help {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
  color: var(--text-dim);
}

.cpub-sharing-input {
  width: 100%;
  /* 44px is the WCAG 2.1 AA target floor this repo holds itself to, and these
     are the densest controls on the page. */
  min-height: 44px;
  padding: var(--space-2);
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
}

.cpub-sharing-purpose-choices {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cpub-sharing-choice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-1) var(--space-3);
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-xs);
  color: var(--text);
  cursor: pointer;
  font-weight: 400;
  margin-bottom: 0;
}

.cpub-sharing-item-actions,
.cpub-sharing-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
}

.cpub-sharing-btn {
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  cursor: pointer;
}

.cpub-sharing-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-sharing-btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--color-on-accent);
}

.cpub-sharing-btn-danger {
  color: var(--red-text);
  border-color: var(--red-border);
}

.cpub-sharing-picker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-3) 0;
  max-width: 18rem;
}

.cpub-sharing-picker label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.cpub-sharing-table-wrap {
  overflow-x: auto;
}

.cpub-sharing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.cpub-sharing-caption {
  text-align: left;
  font-size: var(--text-xs);
  color: var(--text-faint);
  padding-bottom: var(--space-2);
}

.cpub-sharing-table th,
.cpub-sharing-table td {
  padding: var(--space-2);
  text-align: left;
  border-bottom: var(--border-width-default) solid var(--border2);
  white-space: nowrap;
}

.cpub-sharing-table thead th {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
  background: var(--surface2);
}

.cpub-sharing-table tbody th {
  font-weight: 600;
  color: var(--text);
  white-space: normal;
}

@media (max-width: 768px) {
  .cpub-sharing-head {
    flex-direction: column;
  }

  .cpub-sharing-grid {
    grid-template-columns: 1fr;
  }

  .cpub-sharing-facts {
    grid-template-columns: 1fr;
  }
}
</style>
