<script setup lang="ts">
/**
 * /settings/privacy — purpose consent, profile visibility and the subject-rights
 * links (plan sections 6.8, 6.9 and 8.7).
 *
 * Every sentence of consent copy on this page comes from the server, which reads
 * it from the purpose registry in `@commonpub/persona`. Nothing here paraphrases
 * a purpose: a wording that can drift from the behaviour it describes is the
 * defect the registry exists to prevent, and this layer does not depend on that
 * package precisely so the copy cannot be forked into a component.
 *
 * Four rules on this page are load bearing and are covered by tests, not by
 * convention:
 *
 *  1. Every switch is OFF unless the server says the grant is currently
 *     authorised. Absence is never consent, and a stale grant authorises
 *     nothing.
 *  2. `offSummary` is rendered ABOVE `onSummary` on every card, always. What is
 *     true right now is read before what would change.
 *  3. Revoking is one click on the same control that granted, with no
 *     confirmation dialog and no second step. Refusing is never harder than
 *     agreeing.
 *  4. A stale grant renders a passive card. No modal, no email, no nag.
 *
 * ---------------------------------------------------------------------------
 * ROUTES CONSUMED
 * ---------------------------------------------------------------------------
 * GET /api/consent/purposes          -> ConsentPurposesPayload. Offerable
 *   purposes only; the server owns that decision exactly as `/api/consent/status`
 *   owns the terms decision.
 * PUT /api/consent/purposes          -> `{ purpose, grant, scopeDigest }`,
 *   `.strict()`, one purpose per request. A bulk endpoint invites an "enable all"
 *   affordance and there will not be one. On a stale digest the route answers 409
 *   with `data: ScopeChangedErrorData`.
 * GET /api/consent/purposes/history  -> `{ history }`, the append-only record
 *   behind the history table. NOT YET IMPLEMENTED: the card payload deliberately
 *   does not carry it, so this page distinguishes "no choices yet" from "could
 *   not load" rather than printing a reassuring falsehood.
 * GET /api/consent/disclosures       -> `{ disclosures }`, who has actually read
 *   this member through the hiring directory, per recipient. Behind the
 *   `memberDirectory` flag; the same "could not load" rule applies and matters
 *   more here, because this block is effectively a legal record.
 *
 * `profileVisibility` is sent through the existing `PUT /api/profile`, and the
 * control WORKS: `updateProfileSchema` and `updateUserProfile` both learned the
 * column (plan 14.8), and `GET /api/profile` returns it owner-only. What remains
 * deferred is ENFORCEMENT of that setting on the app's own read paths and on the
 * federation actor routes, which is Phase 0 and ships unflagged on its own. The
 * aggregation query already honours it, which is what B3's disclosure is about.
 */
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Privacy, ${useSiteName()}` });

const { dataSharingConsents: consentsEnabled, memberDirectory: directoryEnabled } = useFeatures();
const { show: toast } = useToast();
const { extract } = useApiError();

type PurposeState = 'granted' | 'revoked' | 'absent';
type ProfileVisibility = 'public' | 'members' | 'private';

/** Mirrors `ConsentPurposeRecipient` in `server/api/consent/purposes.get.ts`. */
interface RecipientDto {
  id: string;
  name: string;
  privacyPolicyUrl: string;
  relationship: 'processor' | 'joint_controller' | 'independent_controller';
}

interface PurposeDto {
  id: string;
  label: string;
  offSummary: string;
  onSummary: string;
  revocationEffect: string;
  legalBasis: string;
  answersAfterRevocation: string;
  recipients: RecipientDto[];
  state: PurposeState;
  /** True only for a STALE grant. A refusal is never re-asked. */
  needsReconfirmation: boolean;
  actedAt: string | null;
}

interface ConsentHistoryRowDto {
  id: string;
  purpose: string;
  state: 'granted' | 'revoked';
  actedAt: string;
  policyVersion: string;
  scopeDigest: string;
  source: string | null;
  scopeSnapshot: {
    purposeLabel: string;
    offSummary: string;
    onSummary: string;
    recipients: Array<{ id: string; name: string; relationship: string }>;
    dataClasses: string[];
    aggregatableFieldKeys: string[];
    policyVersion: string;
  } | null;
}

/** A registered purpose this instance does not offer. Rendered as a sentence. */
interface DeferredPurposeDto {
  id: string;
  label: string;
}

interface ConsentPurposesResponse {
  scopeDigest: string;
  policyVersion: string;
  purposes: PurposeDto[];
  /**
   * Purposes the registry knows about that this instance is not offering.
   *
   * Rendered because the silence was the problem: a member reading a heading
   * called "Sharing choices" with one switch under it cannot tell whether the
   * other options were never built or are quietly on. The list comes from the
   * server, derived from the registry minus the offered set, so the sentence
   * cannot outlive the deferral.
   */
  deferredPurposes: DeferredPurposeDto[];
  minBucket: number;
  minPopulation: number;
}

/** The 409 body, one level deeper than it looks: h3 nests `createError({ data })`. */
interface ScopeChangedData {
  code: 'SCOPE_CHANGED';
  retryable: false;
  /** The live digest the client must confirm against. */
  expectedScopeDigest: string;
  receivedScopeDigest: string;
  policyVersion: string;
  purposes?: PurposeDto[];
  diff: {
    /** False when the server holds no record of what this client's digest covered. */
    resolved: boolean;
    recipientsAdded: RecipientDto[];
    recipientsRemoved: Array<{ id: string; name: string }>;
    countedFieldsAdded: string[];
    countedFieldsRemoved: string[];
    policyVersionChanged: { from: string; to: string } | null;
    /** True when a list was cut. Never claim a partial list is whole. */
    truncated: boolean;
  };
}

const { data, pending, refresh } = await useFetch<ConsentPurposesResponse>('/api/consent/purposes', {
  immediate: consentsEnabled.value,
});

const {
  data: historyData,
  error: historyError,
} = await useFetch<{ history: ConsentHistoryRowDto[] }>('/api/consent/purposes/history', {
  immediate: consentsEnabled.value,
});

/** Mirrors `MemberDisclosureRow` in `server/api/consent/disclosures.get.ts`. */
interface DisclosureRowDto {
  recipientId: string;
  recipientName: string;
  /** False when no declared recipient carries this id any more. */
  recipientKnown: boolean;
  purposes: string[];
  count: number;
  lastDisclosedAt: string;
}

const {
  data: disclosureData,
  error: disclosureError,
} = await useFetch<{ disclosures: DisclosureRowDto[] }>('/api/consent/disclosures', {
  immediate: consentsEnabled.value && directoryEnabled.value,
});

const purposes = computed<PurposeDto[]>(() => data.value?.purposes ?? []);
/**
 * Registered purposes this instance is NOT offering, named so the deferral is
 * stated rather than merely true. An operator who read the requirement and
 * turned the flag on would otherwise conclude two thirds of what they asked for
 * was never built. `/api/admin/persona-metrics` is already honest about this
 * (`purpose_not_offered`); this page was the only surface that was silent.
 */
const deferredPurposes = computed<DeferredPurposeDto[]>(
  () => data.value?.deferredPurposes ?? [],
);
const history = computed<ConsentHistoryRowDto[]>(() => historyData.value?.history ?? []);
const historyUnavailable = computed<boolean>(() => historyError.value != null);

/**
 * Who has actually read this member through the hiring directory (D6).
 *
 * The block renders NOTHING when there is no history: a person who has never
 * been looked at should not be shown an empty table implying they might be, and
 * an instance with the flag off has no such surface to report on at all.
 *
 * "Could not load" is a different fact from "nobody has looked", and only one of
 * them is reassuring. Printing the reassuring one for both is how a record of
 * who received your personal data quietly becomes a claim nobody checked, which
 * is the same failure the consent history above already guards against and is
 * worse here, because this is the Art. 15 answer to "who has my data".
 */
const disclosures = computed<DisclosureRowDto[]>(
  () => (directoryEnabled.value ? disclosureData.value?.disclosures ?? [] : []),
);
const disclosuresUnavailable = computed<boolean>(
  () => directoryEnabled.value && consentsEnabled.value && disclosureError.value != null,
);
const scopeDigest = computed<string>(() => data.value?.scopeDigest ?? '');

/**
 * What the user has clicked but not yet been able to record, keyed by purpose.
 * It exists for exactly one case: a 409 leaves the toggle where the user left it
 * and asks for one more click against the scope they can now read. It is never
 * auto-retried and never auto-applied, because that would record a grant against
 * a disclosure nobody read.
 */
const pendingIntent = ref<Record<string, boolean>>({});
const scopeChange = ref<Record<string, ScopeChangedData>>({});
const busyPurpose = ref<string | null>(null);

/**
 * A switch is ON only when the server says a grant is CURRENTLY authorised.
 * `state === 'granted'` alone is not enough: a stale grant authorises nothing,
 * and rendering it as on would claim something is being shared when the
 * analytics join has already stopped counting it.
 */
function isOn(purpose: PurposeDto): boolean {
  const intent = pendingIntent.value[purpose.id];
  if (intent !== undefined) return intent;
  return purpose.state === 'granted' && !purpose.needsReconfirmation;
}

function scopeChangeFor(purposeId: string): ScopeChangedData | null {
  return scopeChange.value[purposeId] ?? null;
}

/** Plain sentences for the diff. The registry copy stays the server's; this is
 *  a description of what moved, not a restatement of what a purpose does. */
function scopeChangeLines(change: ScopeChangedData): string[] {
  const lines: string[] = [];
  const added = change.diff.recipientsAdded.map((r) => r.name);
  const removed = change.diff.recipientsRemoved.map((r) => r.name);
  if (added.length) {
    lines.push(`Added while you were reading this page: ${added.join(', ')}.`);
  }
  if (removed.length) {
    lines.push(`No longer listed: ${removed.join(', ')}.`);
  }
  if (change.diff.countedFieldsAdded.length || change.diff.countedFieldsRemoved.length) {
    lines.push('The set of answers this would cover changed while you were reading this page.');
  }
  if (change.diff.policyVersionChanged) {
    lines.push('The privacy policy was updated while you were reading this page.');
  }
  if (change.diff.truncated) {
    // The server cut the list. Saying so is the difference between a summary
    // and a claim that this is everything.
    lines.push('There are more changes than are listed here.');
  }
  if (!lines.length) {
    // `resolved: false` is the normal case for a first grant: a digest is one
    // way, so there is nothing to invert into a diff. Say what is known.
    lines.push('What this covers changed while you were reading this page.');
  }
  return lines;
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function readScopeChanged(err: unknown): ScopeChangedData | null {
  const e = err as {
    statusCode?: number;
    data?: { data?: unknown; code?: string };
  };
  if (e?.statusCode !== 409) return null;
  const nested = (e.data?.data ?? e.data) as Partial<ScopeChangedData> | undefined;
  if (!nested || nested.code !== 'SCOPE_CHANGED' || !nested.diff) return null;
  return nested as ScopeChangedData;
}

/**
 * One click, in both directions, on the same control. There is no confirmation
 * step: making the refusal cost an extra click is the asymmetry this design
 * refuses.
 */
async function setPurpose(purpose: PurposeDto, grant: boolean): Promise<void> {
  busyPurpose.value = purpose.id;
  try {
    await $fetch('/api/consent/purposes', {
      method: 'PUT',
      body: { purpose: purpose.id, grant, scopeDigest: scopeDigest.value },
    });
    await refresh();
    // The server is the record. Once it agrees, the local intent and the stale
    // diff have no job left, so neither can outlive the thing it described.
    pendingIntent.value = omitKey(pendingIntent.value, purpose.id);
    scopeChange.value = omitKey(scopeChange.value, purpose.id);
    toast(grant ? 'Turned on' : 'Turned off', 'success');
  } catch (err: unknown) {
    const changed = readScopeChanged(err);
    if (changed) {
      // Leave the toggle where the user left it, show what moved, ask once more.
      pendingIntent.value = { ...pendingIntent.value, [purpose.id]: grant };
      scopeChange.value = { ...scopeChange.value, [purpose.id]: changed };
      await refresh();
      return;
    }
    toast(extract(err), 'error');
  } finally {
    busyPurpose.value = null;
  }
}

function toggle(purpose: PurposeDto): void {
  // While a scope change is showing, the switch already sits where the user put
  // it and NOTHING has been recorded, so the next click CONFIRMS that choice
  // against the scope they can now read rather than flipping it back. A user who
  // has changed their mind simply does not click: not clicking records nothing,
  // which is the safe default in both directions.
  const next = scopeChangeFor(purpose.id) ? isOn(purpose) : !isOn(purpose);
  void setPurpose(purpose, next);
}

const relationshipLabels: Record<RecipientDto['relationship'], string> = {
  processor: 'acts only on the instructions of this site',
  joint_controller: 'decides jointly with this site how your data is used',
  independent_controller: 'decides on its own how your data is used',
};

function relationshipLabel(relationship: RecipientDto['relationship']): string {
  return relationshipLabels[relationship];
}

/* Profile visibility. Live column, first settable control for it. */
interface ProfileDto {
  profileVisibility?: ProfileVisibility;
}

const { data: profile, refresh: refreshProfile } = await useFetch<ProfileDto>('/api/profile', {
  immediate: consentsEnabled.value,
});
const visibility = ref<ProfileVisibility>('public');
const visibilitySaving = ref(false);
const visibilityError = ref<string | null>(null);

watchEffect(() => {
  const stored = profile.value?.profileVisibility;
  if (stored) visibility.value = stored;
});

const visibilityHints: Record<ProfileVisibility, string> = {
  public: 'Anyone can see your profile, including people who are not signed in.',
  members: 'Only people signed in to this site can see your profile.',
  private: 'Only you can see your profile.',
};

/**
 * Appendix B3's inline note, ON THE TOGGLE and independent of grant state.
 *
 * It used to live below the purpose cards, inside "Who can see your profile",
 * and to appear only once a grant already existed. Both halves were wrong: the
 * person who most needs it is the one whose profile is ALREADY private and who
 * is deciding whether to turn counting on, and B3 asks for the note where the
 * decision is taken. It is also wired into the switch's `aria-describedby`, so a
 * screen-reader user on the control hears it rather than finding it two
 * sections later.
 */
const visibilityBlocksCounting = computed<boolean>(() => visibility.value !== 'public');

async function saveVisibility(): Promise<void> {
  visibilitySaving.value = true;
  visibilityError.value = null;
  try {
    await $fetch('/api/profile', { method: 'PUT', body: { profileVisibility: visibility.value } });
    await refreshProfile();
    toast('Visibility saved', 'success');
  } catch (err: unknown) {
    const message = extract(err);
    visibilityError.value = message;
    toast(message, 'error');
  } finally {
    visibilitySaving.value = false;
  }
}

/* Dates. `toLocaleDateString` formats in the RENDERER's timezone, so the server
 * (UTC in production) and the viewer's browser disagree about the day near
 * midnight. Render the human string only after mount; the `datetime` attribute
 * carries the raw ISO value, so SSR and assistive tech still get the date. */
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

function isoOf(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function humanDate(value: string): string {
  const iso = isoOf(value);
  if (!mounted.value || !iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The disclosure lines carry the date INSIDE a sentence, so an empty string
 * before mount would read "most recently ." rather than merely omitting a
 * column. The ISO day is rendered on the server and replaced by the reader's
 * own format once mounted; the `datetime` attribute is the machine-readable
 * value either way, so nothing is lost to a crawler or to assistive tech.
 */
function isoDay(value: string): string {
  return isoOf(value).slice(0, 10);
}

function longDate(value: string): string {
  const iso = isoOf(value);
  if (!iso) return '';
  if (!mounted.value) return isoDay(value);
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * A recipient whose id no longer resolves is named as unresolvable rather than
 * dropped. The row is evidence that a disclosure happened, and an operator
 * removing a recipient from their config must not be able to erase it.
 */
function disclosureRecipient(row: DisclosureRowDto): string {
  return row.recipientKnown
    ? row.recipientName
    : `A recipient this site no longer lists (${row.recipientId})`;
}

function disclosureTimes(row: DisclosureRowDto): string {
  return row.count === 1 ? '1 time' : `${row.count} times`;
}

/**
 * One sentence naming what this site does not offer, and stating plainly that
 * nothing is shared with those parties. Built from the server's list, so it
 * disappears the moment a purpose becomes offerable.
 */
const deferredSentence = computed<string>(() => {
  const labels = deferredPurposes.value.map((p) => p.label.toLowerCase());
  if (labels.length === 0) return '';
  const joined =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `This site does not offer these choices yet: ${joined}. Nothing is shared for them.`;
});

/** Art. 13(1)(c): the lawful basis, in words a person reads rather than a code. */
function legalBasisLabel(basis: string): string {
  return basis === 'consent'
    ? 'This happens only because you said yes.'
    : `Legal basis: ${basis}.`;
}

/** What happens to the ANSWERS after a withdrawal, as opposed to the processing. */
function answersLabel(effect: string): string {
  return effect === 'kept_on_your_profile'
    ? 'Your answers stay on your profile either way.'
    : '';
}

function historyChoice(row: ConsentHistoryRowDto): string {
  return row.state === 'granted' ? 'Turned on' : 'Turned off';
}

function historyLabel(row: ConsentHistoryRowDto): string {
  return row.scopeSnapshot?.purposeLabel ?? row.purpose;
}
</script>

<template>
  <div class="cpub-privacy-settings">
    <h2 class="cpub-section-title-lg">Privacy</h2>

    <p v-if="!consentsEnabled" class="cpub-privacy-note">
      Sharing choices are not enabled on this site.
    </p>

    <template v-else>
      <section class="cpub-privacy-block" aria-labelledby="cpub-sharing-heading">
        <h3 id="cpub-sharing-heading" class="cpub-privacy-subhead">Sharing choices</h3>
        <p class="cpub-privacy-note">
          Every choice here is off unless you turn it on, and you can turn any of them off again at
          any time.
        </p>

        <p v-if="pending && !purposes.length" class="cpub-privacy-note" aria-busy="true">
          Loading your choices...
        </p>

        <p v-else-if="!purposes.length" class="cpub-privacy-note">
          This site does not ask you to share anything at the moment.
        </p>

        <div v-else class="cpub-purpose-list">
          <div v-for="purpose in purposes" :key="purpose.id" class="cpub-purpose-slot">
            <!-- The 409 diff renders ABOVE the card it belongs to, so what
                 changed is read before the control is reached again. -->
            <div
              v-if="scopeChangeFor(purpose.id)"
              class="cpub-purpose-diff"
              role="status"
              aria-live="polite"
            >
              <p v-for="line in scopeChangeLines(scopeChangeFor(purpose.id)!)" :key="line">
                {{ line }}
              </p>
              <p>
                Nothing has been recorded. Read the details below, then press the switch again to
                confirm your choice.
              </p>
            </div>

            <article class="cpub-purpose-card">
              <h4 :id="`cpub-purpose-${purpose.id}`" class="cpub-purpose-title">
                {{ purpose.label }}
              </h4>

              <!-- offSummary FIRST, always. Anti-dark-pattern rule 9. -->
              <p class="cpub-purpose-off">{{ purpose.offSummary }}</p>
              <p class="cpub-purpose-on">{{ purpose.onSummary }}</p>

              <div v-if="purpose.recipients.length" class="cpub-purpose-recipients">
                <p class="cpub-purpose-recipients-lead">Shared with:</p>
                <ul class="cpub-recipient-list">
                  <li v-for="recipient in purpose.recipients" :key="recipient.id">
                    <span class="cpub-recipient-name">{{ recipient.name }}</span>
                    <span class="cpub-recipient-rel">{{ relationshipLabel(recipient.relationship) }}</span>
                    <a
                      class="cpub-recipient-policy"
                      :href="recipient.privacyPolicyUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Privacy policy for {{ recipient.name }}
                    </a>
                  </li>
                </ul>
              </div>

              <p class="cpub-purpose-revocation">{{ purpose.revocationEffect }}</p>

              <!--
                The Art. 13 disclosures the card exists for. Both were carried
                on the payload, typed on this page, asserted by two tests, and
                rendered nowhere: a field that is specified, transported, typed
                and tested but never reaches a reader is not a disclosure.
              -->
              <p class="cpub-purpose-basis">
                {{ legalBasisLabel(purpose.legalBasis) }}
                {{ answersLabel(purpose.answersAfterRevocation) }}
              </p>

              <!-- A stale grant is passive. No modal, no email, no nag. -->
              <p
                v-if="purpose.needsReconfirmation"
                class="cpub-purpose-stale"
              >
                This needs your confirmation again. We added a recipient since you agreed. Nothing is
                being shared in the meantime.
              </p>

              <!--
                B3: the aggregation query filters on a public profile, so a
                member whose profile is private is not counted even with this
                on. Shown at the moment of the decision, not after it.
              -->
              <p
                v-if="visibilityBlocksCounting"
                :id="`cpub-purpose-visibility-${purpose.id}`"
                class="cpub-purpose-visibility"
              >
                Your profile is not public right now, so your answers are not counted even with this
                turned on. You can change that below.
              </p>

              <div class="cpub-purpose-actions">
                <button
                  type="button"
                  role="switch"
                  class="cpub-purpose-switch"
                  :aria-checked="isOn(purpose) ? 'true' : 'false'"
                  :aria-labelledby="`cpub-purpose-${purpose.id}`"
                  :aria-describedby="visibilityBlocksCounting
                    ? `cpub-purpose-state-${purpose.id} cpub-purpose-visibility-${purpose.id}`
                    : `cpub-purpose-state-${purpose.id}`"
                  :disabled="busyPurpose === purpose.id"
                  @click="toggle(purpose)"
                >
                  <span class="cpub-purpose-switch-track" aria-hidden="true">
                    <span class="cpub-purpose-switch-thumb"></span>
                  </span>
                  <span class="cpub-purpose-switch-text">{{ isOn(purpose) ? 'On' : 'Off' }}</span>
                </button>
                <span :id="`cpub-purpose-state-${purpose.id}`" class="cpub-purpose-state">
                  {{ isOn(purpose) ? 'Turn this off at any time.' : 'This is off.' }}
                </span>
              </div>
            </article>
          </div>
        </div>

        <p v-if="deferredPurposes.length" class="cpub-privacy-note">
          {{ deferredSentence }}
        </p>
      </section>

      <!--
        D6, "the member can see who looked". Rendered only when there is
        something to say: no history means no block at all, because an empty
        table under this heading implies a surface is watching a member who
        nobody has looked at. A failed load is NOT no history, and says so.
      -->
      <section
        v-if="disclosures.length || disclosuresUnavailable"
        class="cpub-privacy-block"
        aria-labelledby="cpub-disclosures-heading"
      >
        <h3 id="cpub-disclosures-heading" class="cpub-privacy-subhead">
          Who has looked at your profile through the hiring directory
        </h3>
        <p v-if="disclosuresUnavailable" class="cpub-privacy-note" role="alert">
          The record of who has looked could not be loaded. Nothing has changed, and you can still
          use Download my data to see the full record.
        </p>
        <template v-else>
          <ul class="cpub-disclosure-list">
            <li v-for="row in disclosures" :key="row.recipientId">
              {{ disclosureRecipient(row) }}, {{ disclosureTimes(row) }}, most recently
              <time :datetime="row.lastDisclosedAt">{{ longDate(row.lastDisclosedAt) }}</time>.
            </li>
          </ul>
          <!--
            D5. This sentence is the honest one and must not be softened: a
            revocation removes you from the next response and cannot unring a
            bell. Copy that implied recall would be a promise this system
            cannot keep on behalf of a third party.
          -->
          <p class="cpub-privacy-note">
            Turning this off removes you from future results. It cannot recall what was already
            shared.
          </p>
        </template>
      </section>

      <section class="cpub-privacy-block" aria-labelledby="cpub-visibility-heading">
        <h3 id="cpub-visibility-heading" class="cpub-privacy-subhead">Who can see your profile</h3>
        <div class="cpub-field">
          <label for="cpub-profile-visibility" class="cpub-form-label">Profile visibility</label>
          <select
            id="cpub-profile-visibility"
            v-model="visibility"
            class="cpub-input cpub-visibility-select"
            aria-describedby="cpub-visibility-hint"
          >
            <option value="public">Public</option>
            <option value="members">Members only</option>
            <option value="private">Only me</option>
          </select>
          <p id="cpub-visibility-hint" class="cpub-privacy-note">{{ visibilityHints[visibility] }}</p>
          <p v-if="visibilityBlocksCounting" class="cpub-privacy-note">
            While your profile is not public, your answers are not counted, even with sharing turned
            on.
          </p>
          <p v-if="visibilityError" class="cpub-field-error" role="alert">{{ visibilityError }}</p>
          <button
            type="button"
            class="cpub-btn cpub-btn-sm"
            :disabled="visibilitySaving"
            @click="saveVisibility"
          >
            {{ visibilitySaving ? 'Saving...' : 'Save visibility' }}
          </button>
        </div>
      </section>

      <section class="cpub-privacy-block" aria-labelledby="cpub-rights-heading">
        <h3 id="cpub-rights-heading" class="cpub-privacy-subhead">Your data</h3>
        <p class="cpub-privacy-note">
          You can take a copy of everything this site holds about you, or close your account.
        </p>
        <div class="cpub-rights-actions">
          <a href="/api/auth/export-data" download class="cpub-btn cpub-btn-sm">
            <i class="fa-solid fa-download" aria-hidden="true"></i> Download my data
          </a>
          <NuxtLink to="/settings/account" class="cpub-btn cpub-btn-sm">
            Delete my account
          </NuxtLink>
        </div>
      </section>

      <section class="cpub-privacy-block" aria-labelledby="cpub-history-heading">
        <h3 id="cpub-history-heading" class="cpub-privacy-subhead">What you have chosen</h3>
        <!-- "Could not load" and "you have chosen nothing" are different facts,
             and printing the reassuring one for both is how a record of consent
             quietly becomes a claim nobody checked. -->
        <p v-if="historyUnavailable" class="cpub-privacy-note" role="alert">
          Your record of past choices could not be loaded. Nothing has changed, and you can still use
          Download my data to see the full record.
        </p>
        <p v-else-if="!history.length" class="cpub-privacy-note">
          You have not made any sharing choices yet.
        </p>
        <div v-else class="cpub-history-scroll">
          <table class="cpub-history-table">
            <caption class="cpub-history-caption">
              Every sharing choice you have made, newest first, with what was shown to you at the
              time.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Choice</th>
                <th scope="col">What was shown</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in history" :key="row.id">
                <td>
                  <time :datetime="isoOf(row.actedAt)">{{ humanDate(row.actedAt) }}</time>
                </td>
                <td>{{ historyChoice(row) }} {{ historyLabel(row) }}</td>
                <td>
                  <details v-if="row.scopeSnapshot" class="cpub-history-details">
                    <summary>What you were shown</summary>
                    <p>{{ row.scopeSnapshot.offSummary }}</p>
                    <p>{{ row.scopeSnapshot.onSummary }}</p>
                    <p v-if="row.scopeSnapshot.recipients.length">
                      Shared with:
                      {{ row.scopeSnapshot.recipients.map((r) => r.name).join(', ') }}
                    </p>
                    <p>Privacy policy version {{ row.scopeSnapshot.policyVersion }}</p>
                  </details>
                  <span v-else>Privacy policy version {{ row.policyVersion }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cpub-privacy-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-width: 720px;
}

.cpub-privacy-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cpub-privacy-subhead {
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
}

.cpub-privacy-note {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-faint);
}

.cpub-purpose-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-purpose-slot {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cpub-purpose-diff {
  padding: var(--space-3);
  border: var(--border-width-default) solid var(--yellow-border);
  background: var(--yellow-bg);
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}

.cpub-purpose-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.cpub-purpose-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.cpub-purpose-off {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}

.cpub-purpose-on,
.cpub-purpose-basis,
.cpub-purpose-revocation {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-purpose-recipients-lead {
  font-size: 13px;
  color: var(--text);
}

.cpub-recipient-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.cpub-recipient-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  line-height: 1.6;
}

.cpub-recipient-name {
  color: var(--text);
  font-weight: 600;
}

.cpub-recipient-rel {
  color: var(--text-dim);
  font-size: 12px;
}

.cpub-recipient-policy {
  color: var(--accent);
  text-decoration: underline;
  font-size: 12px;
}

.cpub-recipient-policy:focus-visible,
.cpub-history-details summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Appendix B3's inline note, on the card, at the moment of the decision. Same
   treatment as the stale-grant note: this is information, not a warning. */
.cpub-purpose-visibility,
.cpub-purpose-stale {
  padding: var(--space-3);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}

.cpub-purpose-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

/* The grant control and the revoke control are the same control, at the same
   size, in both directions. There is no smaller, lighter way to say no. */
.cpub-purpose-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-2) var(--space-4);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.cpub-purpose-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-purpose-switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cpub-purpose-switch[aria-checked='true'] {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}

.cpub-purpose-switch-track {
  display: inline-flex;
  align-items: center;
  width: 34px;
  height: 18px;
  padding: 2px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-purpose-switch[aria-checked='true'] .cpub-purpose-switch-track {
  border-color: var(--accent);
  justify-content: flex-end;
}

.cpub-purpose-switch-thumb {
  display: block;
  width: 12px;
  height: 12px;
  background: var(--text-dim);
}

.cpub-purpose-switch[aria-checked='true'] .cpub-purpose-switch-thumb {
  background: var(--accent);
}

.cpub-purpose-state {
  font-size: 12px;
  color: var(--text-faint);
}

/* One line per recipient. A list, not a table: three facts per row do not need
   column headers, and the sentence reads as a sentence. */
.cpub-disclosure-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}

.cpub-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.cpub-field-error {
  font-size: 12px;
  color: var(--red-text);
}

/* The chrome comes from the global `.cpub-input`; only the AA target size and
   the measure are this page's business. */
.cpub-visibility-select {
  min-height: 44px;
  max-width: 260px;
}

.cpub-visibility-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-rights-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.cpub-history-scroll {
  overflow-x: auto;
}

.cpub-history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.cpub-history-caption {
  text-align: left;
  padding-bottom: var(--space-2);
  color: var(--text-faint);
  line-height: 1.7;
}

.cpub-history-table th,
.cpub-history-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width-default) solid var(--border);
  vertical-align: top;
}

.cpub-history-table th {
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
}

.cpub-history-details summary {
  cursor: pointer;
  color: var(--accent);
}

.cpub-history-details p {
  margin-top: var(--space-2);
  line-height: 1.7;
  color: var(--text-dim);
}
</style>
