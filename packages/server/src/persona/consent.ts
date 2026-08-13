import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  type PurposeScopeSnapshot,
  type UserPurposeConsentRow,
  userPurposeConsents,
} from '@commonpub/schema';
import {
  BUILTIN_PERSONA_SECTIONS,
  PERSONA_MAX_AGGREGATABLE_BUCKETS,
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
  PURPOSE_COPY_MAX_LENGTH,
  type DataRecipient,
  type PersonaDataClass,
  type PersonaSection,
  type ProcessingPurposeId,
  dataSharingConfigSchema,
  isPersonaFieldAggregatable,
  isPersonaFieldType,
  personaConfigSchema,
  purposeIsOfferable,
  purposeScopeDigest,
  renderPurposeOnSummary,
} from '@commonpub/persona';
import type { DB } from '../types.js';

/**
 * Purpose consent: the GDPR Art. 6(1)(a) record for persona data processing.
 *
 * WHY THIS IS NOT `recordConsent` (`../profile/consent.ts`). That service dedups
 * on "the latest row of this kind already has this version", so a grant, then a
 * revoke, then a grant at one policy version collapses to a single row and a
 * withdrawal is not representable at all. Consent that cannot be withdrawn is
 * not consent. `user_purpose_consents` is therefore the primary store, written
 * supersede-then-insert, and it carries the full history on its own.
 *
 * Section 14.4 of the plan: NO `sharing:*` audit row is written into
 * `user_consents` and that live GDPR table is not widened. The DSAR export gains
 * a `purposeConsents` section instead, which is strictly more informative (it
 * carries the state, the scope digest and the snapshot of what was shown).
 *
 * Section 14.5: there is no `consent_proofs` table in v1, so there is no
 * erasure tombstone. All four persona tables cascade on `users.id`, so account
 * deletion needs no code here at all. v1 makes no onward disclosure, so there is
 * nothing an erasure-surviving proof would defend.
 */

// --- Errors ---------------------------------------------------------------------

/**
 * Base for every failure a route has to turn into a status code. `status` is
 * carried on the error rather than mapped in each route, so two routes cannot
 * disagree about what a scope change means.
 */
export class PurposeConsentError extends Error {
  /** Stable machine code, safe to render to a client. */
  public readonly code: string;
  /** HTTP status a route should surface. */
  public readonly status: number;
  /** Whether re-issuing the identical request could succeed. */
  public readonly retryable: boolean;

  constructor(message: string, opts: { code: string; status: number; retryable: boolean }) {
    super(message);
    this.name = 'PurposeConsentError';
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable;
  }
}

/**
 * The live scope moved between the page render and the click, so the grant would
 * be recorded against a disclosure the user never read.
 *
 * NOT retryable: the route returns 409 with the new purpose list, the settings
 * page renders the diff inline, and the user confirms once more against the new
 * scope. Never auto-retry and never auto-apply the pending grant.
 */
export class PurposeScopeChangedError extends PurposeConsentError {
  public readonly expectedScopeDigest: string;
  public readonly receivedScopeDigest: string;

  constructor(expected: string, received: string) {
    super('The sharing scope changed while you were reading this page', {
      code: 'SCOPE_CHANGED',
      status: 409,
      retryable: false,
    });
    this.name = 'PurposeScopeChangedError';
    this.expectedScopeDigest = expected;
    this.receivedScopeDigest = received;
  }
}

/**
 * Two writers raced for one (user, purpose) and collided on the partial unique
 * index `uq_purpose_current` (Appendix B16).
 *
 * RETRYABLE: the loser re-reads and re-applies. This exists so a race surfaces
 * as a 409 the client can resolve rather than a 500 that reads as "consent is
 * broken".
 */
export class PurposeConsentConflictError extends PurposeConsentError {
  constructor(public readonly purpose: string) {
    super(`Another change to "${purpose}" landed first; re-read and try again`, {
      code: 'CONSENT_CONFLICT',
      status: 409,
      retryable: true,
    });
    this.name = 'PurposeConsentConflictError';
  }
}

/**
 * A grant was attempted for a purpose this instance does not offer.
 *
 * 404, not 403: an unoffered purpose does not exist as far as a client is
 * concerned, which is the same posture `requireFeature` takes. A REVOCATION of
 * an unoffered purpose is always allowed, because withdrawal must never be
 * gated on anything.
 */
export class PurposeNotOfferedError extends PurposeConsentError {
  constructor(public readonly purpose: string) {
    super(`Purpose "${purpose}" is not offered on this instance`, {
      code: 'PURPOSE_NOT_OFFERED',
      status: 404,
      retryable: false,
    });
    this.name = 'PurposeNotOfferedError';
  }
}

/** A snapshot that cannot be bounded. See {@link PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES}. */
export class PurposeScopeSnapshotTooLargeError extends PurposeConsentError {
  constructor(public readonly bytes: number) {
    super(
      `The consent snapshot is ${bytes} bytes, over the ${PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES} byte budget. `
      + 'Reduce the number of declared data recipients.',
      { code: 'SNAPSHOT_TOO_LARGE', status: 500, retryable: false },
    );
    this.name = 'PurposeScopeSnapshotTooLargeError';
  }
}

/** A hand-built snapshot broke one of the bounded shape's caps. */
export class InvalidPurposeScopeSnapshotError extends PurposeConsentError {
  constructor(public readonly reason: string) {
    super(`Invalid consent snapshot: ${reason}`, {
      code: 'INVALID_SNAPSHOT',
      status: 500,
      retryable: false,
    });
    this.name = 'InvalidPurposeScopeSnapshotError';
  }
}

// --- The offered set ------------------------------------------------------------

/**
 * The purposes whose READ surface exists in this release (plan section 6.10).
 *
 * All three are listed as of the member visibility directory
 * (`docs/plans/member-visibility-directory.md` section 5).
 * `recruiter_visibility` and `sponsor_sharing` always carried a full registry
 * entry and full member-facing copy; what they lacked was a surface that
 * honoured the grant, and asking for a consent nothing can act on is exactly
 * what Art. 4(11) specificity forbids. That surface now exists: the directory
 * lists a consenting member to a named recipient, writes a disclosure row per
 * recipient, and shows the member who looked.
 *
 * THIS LINE IS NOT THE SWITCH THAT DISCLOSES ANYTHING, and that is the safety
 * property worth stating rather than assuming. `purposeIsOfferable` still has
 * the last word: a purpose whose `requiresRecipients` is true and which no
 * declared recipient covers is not offerable, and a covering recipient that is a
 * joint or independent controller with no `agreementRef` makes it unofferable
 * too. So on an instance that has declared no recipient, this change alters
 * nothing a member sees: `/settings/privacy` still shows one toggle, the scope
 * digest does not move, and no existing grant is disturbed. An operator cannot
 * deploy past an unpapered onward transfer by editing this array.
 *
 * The directory endpoint itself is additionally gated on the `memberDirectory`
 * feature flag, which defaults off. Consent is necessary and never sufficient.
 */
export const OFFERED_PROCESSING_PURPOSES: readonly ProcessingPurposeId[] = [
  'profile_analytics',
  'recruiter_visibility',
  'sponsor_sharing',
];

/**
 * The registered purposes this instance is NOT offering, with their labels.
 *
 * Exists so the deferral can be SAID rather than merely be true. A member who
 * reads a heading called "Sharing choices" and sees one switch cannot tell
 * whether recruiter and sponsor sharing were never built or are quietly on;
 * `/api/admin/persona-metrics` is honest about this (`purpose_not_offered`) and
 * the member-facing surface was the only one that was silent. Derived from the
 * registry minus the offered list, so the sentence cannot outlive the deferral.
 */
export function deferredProcessingPurposes(
  offered: readonly ProcessingPurposeId[] = OFFERED_PROCESSING_PURPOSES,
): Array<{ purpose: ProcessingPurposeId; label: string }> {
  return PROCESSING_PURPOSES.filter((id) => !offered.includes(id)).map((id) => ({
    purpose: id,
    label: PROCESSING_PURPOSE_SPECS[id].label,
  }));
}

/**
 * Re-exported so the layer's consent routes and pages stop hand-declaring it.
 * There were four copies of this GDPR record shape and only two were tied
 * together by the parity guard at the foot of this module.
 */
export type { PurposeScopeSnapshot };

// --- The bounded snapshot -------------------------------------------------------

/**
 * Byte budget for a serialised `scope_snapshot`.
 *
 * The plan (section 6.4) states the shape is bounded, "not an arbitrary blob",
 * and asks for a worst case under 8 KB. The element caps alone do not deliver
 * that: 50 recipients at their maximum field lengths is ~11 KB before any field
 * key is added. {@link buildPurposeScopeSnapshot} therefore enforces the budget
 * itself, by dropping `aggregatableFieldKeys` (see the note there), and throws
 * {@link PurposeScopeSnapshotTooLargeError} if the copy plus the recipients
 * alone still exceed it. A bound nothing enforces is not a bound.
 */
export const PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES = 8192;

/** Element caps for the bounded snapshot shape (plan section 6.4). */
export const PURPOSE_SCOPE_SNAPSHOT_CAPS = {
  purposeLabel: 120,
  // The copy caps come from `@commonpub/persona`, where the copy is written and
  // where a unit test already fails on a sentence that would be rejected here.
  offSummary: PURPOSE_COPY_MAX_LENGTH,
  onSummary: PURPOSE_COPY_MAX_LENGTH,
  policyVersion: 32,
  recipients: 50,
  recipientId: 40,
  recipientName: 120,
  recipientRelationship: 32,
  dataClasses: 8,
  dataClassId: 40,
  /**
   * 120, not the plan's 300. A field must contribute at least one aggregate
   * bucket to be aggregatable at all, and `personaSectionsSchema` caps a
   * template at `PERSONA_MAX_AGGREGATABLE_BUCKETS` buckets, so more than 120
   * aggregatable field keys is structurally impossible.
   */
  aggregatableFieldKeys: PERSONA_MAX_AGGREGATABLE_BUCKETS,
  fieldKey: 40,
} as const;

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

/**
 * Validate the bounded snapshot shape, throwing on the first violation.
 *
 * DELIBERATELY hand written rather than Zod. `@commonpub/server` has no `zod`
 * dependency and adding one for a seven-field shape would create a package edge
 * for a validator, which is exactly the trade section 14.4 refuses for the URL
 * predicate. The compile-time parity guard at the foot of this module ties the
 * validated shape to `PurposeScopeSnapshot` in `@commonpub/schema`, so the two
 * cannot drift. If a Zod schema is wanted later it belongs in
 * `@commonpub/persona` next to the other schemas, not here.
 */
export function assertPurposeScopeSnapshot(
  value: unknown,
): asserts value is PurposeScopeSnapshot {
  const caps = PURPOSE_SCOPE_SNAPSHOT_CAPS;
  const fail = (reason: string): never => {
    throw new InvalidPurposeScopeSnapshotError(reason);
  };

  const str = (v: unknown, max: number, name: string): string => {
    if (typeof v !== 'string') return fail(`${name} must be a string`);
    if (v.length > max) return fail(`${name} is longer than ${max} characters`);
    return v;
  };

  const arr = (v: unknown, max: number, name: string): unknown[] => {
    if (!Array.isArray(v)) return fail(`${name} must be an array`);
    if (v.length > max) return fail(`${name} holds more than ${max} entries`);
    return v;
  };

  if (value === null || typeof value !== 'object') fail('snapshot must be an object');
  const s = value as Record<string, unknown>;

  str(s.purposeLabel, caps.purposeLabel, 'purposeLabel');
  str(s.offSummary, caps.offSummary, 'offSummary');
  str(s.onSummary, caps.onSummary, 'onSummary');
  if (str(s.policyVersion, caps.policyVersion, 'policyVersion').length === 0) {
    fail('policyVersion is empty');
  }

  arr(s.recipients, caps.recipients, 'recipients').forEach((entry, i) => {
    if (entry === null || typeof entry !== 'object') fail(`recipients[${i}] must be an object`);
    const r = entry as Record<string, unknown>;
    str(r.id, caps.recipientId, `recipients[${i}].id`);
    str(r.name, caps.recipientName, `recipients[${i}].name`);
    str(r.relationship, caps.recipientRelationship, `recipients[${i}].relationship`);
    if (Object.keys(r).length !== 3) {
      // The snapshot records what was SHOWN. A recipient's country, transfer
      // mechanism or agreement reference is operator paperwork, not consent
      // copy, and must not be copied into every user's row.
      fail(`recipients[${i}] carries keys beyond id, name and relationship`);
    }
  });

  arr(s.dataClasses, caps.dataClasses, 'dataClasses').forEach((c, i) =>
    str(c, caps.dataClassId, `dataClasses[${i}]`),
  );

  arr(s.aggregatableFieldKeys, caps.aggregatableFieldKeys, 'aggregatableFieldKeys').forEach(
    (k, i) => str(k, caps.fieldKey, `aggregatableFieldKeys[${i}]`),
  );

  const bytes = byteLength(value);
  if (bytes > PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES) throw new PurposeScopeSnapshotTooLargeError(bytes);
}

/**
 * Build the snapshot of exactly what the user was shown, from the live scope.
 *
 * The SERVER builds this, never the client: a client-supplied snapshot is a
 * client-supplied record of what it claims to have displayed, which is worth
 * nothing under Art. 7(1).
 *
 * Budget handling: when the serialised snapshot exceeds
 * {@link PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES}, `aggregatableFieldKeys` is truncated
 * from the end of its sorted order and nothing else is touched. Those keys are
 * the least load-bearing element here: they are never rendered on the consent
 * card, and the SCOPE DIGEST stored alongside binds the complete set, so
 * authorisation semantics are unaffected by the truncation. Recipients, the
 * copy and the policy version are never truncated, because they are the record
 * of the disclosure itself.
 */
export function buildPurposeScopeSnapshot(
  purpose: ProcessingPurposeId,
  scope: PurposeScope,
): PurposeScopeSnapshot {
  const spec = PROCESSING_PURPOSE_SPECS[purpose];
  const snapshot: PurposeScopeSnapshot = {
    purposeLabel: spec.label,
    offSummary: spec.offSummary,
    // Rendered against the floors IN FORCE, so the Art. 7(1) record carries the
    // number the member was actually shown rather than a hardcoded five.
    onSummary: renderPurposeOnSummary(purpose, scope),
    // Only the recipients this purpose actually discloses to. A sponsor named
    // for `sponsor_sharing` has nothing to do with an analytics grant, and
    // recording them together would misstate the disclosure.
    recipients: scope.recipients
      .filter((r) => r.purposes.includes(purpose))
      .slice(0, PURPOSE_SCOPE_SNAPSHOT_CAPS.recipients)
      .map((r) => ({ id: r.id, name: r.name, relationship: r.relationship })),
    dataClasses: [...spec.covers],
    aggregatableFieldKeys: scope.aggregatableFieldKeys.slice(
      0,
      PURPOSE_SCOPE_SNAPSHOT_CAPS.aggregatableFieldKeys,
    ),
    policyVersion: scope.policyVersion,
  };

  while (
    byteLength(snapshot) > PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES
    && snapshot.aggregatableFieldKeys.length > 0
  ) {
    snapshot.aggregatableFieldKeys.pop();
  }

  assertPurposeScopeSnapshot(snapshot);
  return snapshot;
}

// --- The live scope -------------------------------------------------------------

/**
 * The slice of the operator config this module reads.
 *
 * Structural on purpose: `CommonPubConfig` satisfies it (both keys are declared
 * there as opaque passthroughs), and a test can supply a two-key literal without
 * constructing a whole config. `@commonpub/config` never learns what a persona
 * section or a data recipient is; `@commonpub/persona` owns both meanings.
 */
export interface PurposeScopeConfig {
  persona?: unknown;
  dataSharing?: unknown;
}

/**
 * Where the effective (post-precedence) documents come from.
 *
 * The DB-override precedence and the drift reconciler live in the persona
 * REGISTRY module, not here, so this module takes them as functions rather than
 * importing that module and owning a second copy of the precedence rules. A
 * caller that has the registry passes it; the defaults below read the config
 * file alone.
 *
 * A caller that forgets to pass the registry computes a digest over the FILE
 * sections while the analytics join counts the DB-resolved ones. That is
 * fail-closed (a digest mismatch authorises nothing) but it is still wrong, so
 * every route that can reach the registry must pass it.
 */
export interface PurposeScopeResolvers {
  sections?: (db: DB, config: PurposeScopeConfig) => Promise<readonly PersonaSection[]>;
  dataSharing?: (db: DB, config: PurposeScopeConfig) => Promise<unknown>;
  /** Overrides {@link OFFERED_PROCESSING_PURPOSES}, for tests and staged rollout. */
  offeredPurposes?: readonly ProcessingPurposeId[];
}

/** Everything a grant is given against, plus the digest that binds it. */
export interface PurposeScope {
  policyVersion: string;
  /** `purposeScopeDigest` over policyVersion + data classes + recipients + field keys. */
  digest: string;
  /** Purposes a user may act on right now, in registry order. */
  offerablePurposes: ProcessingPurposeId[];
  /** Union of the offerable purposes' `covers`, sorted. */
  dataClasses: PersonaDataClass[];
  /** Every declared recipient, validated. */
  recipients: DataRecipient[];
  /** Sorted keys of every field that can become an aggregate bucket. */
  aggregatableFieldKeys: string[];
  /** k-anonymity floors, so a caller does not re-parse `dataSharing`. */
  minBucket: number;
  minPopulation: number;
}

/**
 * Sections from the config file alone. Used when no registry resolver is passed.
 *
 * A malformed `persona` document falls back to the built-in sections rather than
 * throwing: `currentPurposeScope` is on the path of the privacy settings page,
 * and a config typo that makes it impossible to REVOKE consent is a worse
 * failure than a wrong digest, which merely authorises nothing.
 */
function sectionsFromConfig(config: PurposeScopeConfig): readonly PersonaSection[] {
  if (config.persona === undefined || config.persona === null) return BUILTIN_PERSONA_SECTIONS;
  const parsed = personaConfigSchema.safeParse(config.persona);
  if (!parsed.success) return BUILTIN_PERSONA_SECTIONS;
  return parsed.data.sections.length > 0 ? parsed.data.sections : BUILTIN_PERSONA_SECTIONS;
}

/** Recipients and floors from a `dataSharing` document, with schema defaults. */
function parseDataSharing(value: unknown): {
  recipients: DataRecipient[];
  policyVersion: string;
  minBucket: number;
  minPopulation: number;
} {
  const parsed = dataSharingConfigSchema.safeParse(value ?? {});
  if (!parsed.success) {
    // Same reasoning as `sectionsFromConfig`: an unparseable document means no
    // recipients and therefore no disclosure, which is the safe reading.
    const empty = dataSharingConfigSchema.parse({});
    return {
      recipients: [],
      policyVersion: empty.policyVersion,
      minBucket: empty.minBucket,
      minPopulation: empty.minPopulation,
    };
  }
  return {
    recipients: parsed.data.recipients,
    policyVersion: parsed.data.policyVersion,
    minBucket: parsed.data.minBucket,
    minPopulation: parsed.data.minPopulation,
  };
}

/**
 * Every aggregatable field key in a template, sorted and deduped.
 *
 * A field whose TYPE is not in the registry is skipped rather than throwing:
 * a stored template can carry a type a later release removed, and an unknown
 * type is not countable, which is the fail-closed reading.
 */
export function aggregatableFieldKeys(sections: readonly PersonaSection[]): string[] {
  const keys = new Set<string>();
  for (const section of sections) {
    for (const field of section.fields) {
      if (!isPersonaFieldType(field.type)) continue;
      if (isPersonaFieldAggregatable(field)) keys.add(field.key);
    }
  }
  return [...keys].sort();
}

/**
 * The live scope, and the digest every grant is bound to.
 *
 * Two deliberate choices about what moves the digest, both erring toward asking
 * again rather than counting someone who has not agreed to the current terms:
 *
 * - DATA CLASSES are the union over the OFFERABLE purposes only. A purpose that
 *   cannot be granted processes nothing, and taking the union over all three
 *   would mean making a deferred purpose offerable later moves no digest and
 *   re-asks nobody, which is precisely the case that must re-ask.
 * - RECIPIENT IDS are every declared recipient, not only those covering an
 *   offerable purpose. The privacy page lists all of them, and "we added a
 *   recipient since you agreed" is the stale-grant copy this exists to trigger.
 */
export async function currentPurposeScope(
  db: DB,
  config: PurposeScopeConfig,
  resolvers: PurposeScopeResolvers = {},
): Promise<PurposeScope> {
  const sections = resolvers.sections
    ? await resolvers.sections(db, config)
    : sectionsFromConfig(config);
  const sharingDoc = resolvers.dataSharing
    ? await resolvers.dataSharing(db, config)
    : config.dataSharing;

  const { recipients, policyVersion, minBucket, minPopulation } = parseDataSharing(sharingDoc);
  const fieldKeys = aggregatableFieldKeys(sections);
  const offered = resolvers.offeredPurposes ?? OFFERED_PROCESSING_PURPOSES;

  const offerablePurposes = PROCESSING_PURPOSES.filter((id) =>
    purposeIsOfferable(id, {
      recipients,
      aggregatableFieldKeys: fieldKeys,
      enabledPurposes: offered,
    }),
  );

  const classes = new Set<PersonaDataClass>();
  for (const id of offerablePurposes) {
    for (const c of PROCESSING_PURPOSE_SPECS[id].covers) classes.add(c);
  }
  const dataClasses = [...classes].sort();

  return {
    policyVersion,
    digest: purposeScopeDigest({
      policyVersion,
      dataClasses,
      recipientIds: recipients.map((r) => r.id),
      aggregatableFieldKeys: fieldKeys,
    }),
    offerablePurposes: [...offerablePurposes],
    dataClasses,
    recipients,
    aggregatableFieldKeys: fieldKeys,
    minBucket,
    minPopulation,
  };
}

// --- Effective grant ------------------------------------------------------------

/** The only two states a user can put on the record. There is no stored "denied". */
export const PURPOSE_CONSENT_STATES = ['granted', 'revoked'] as const;
export type PurposeConsentState = (typeof PURPOSE_CONSENT_STATES)[number];

export type PurposeConsentSource = 'settings' | 'api';

/** The current row, or the absence of one. */
export interface CurrentPurposeConsent {
  state: string;
  scopeDigest: string;
}

export interface EffectivePurposeGrant {
  /** True only for a grant whose digest equals the live scope digest. */
  authorised: boolean;
  /** True only for a stale GRANT. A revocation is never re-asked automatically. */
  needsReconfirmation: boolean;
}

/**
 * Plan section 6.5, the whole degradation table in one pure function.
 *
 * | prior     | digest matches | effect                                    |
 * |-----------|----------------|-------------------------------------------|
 * | granted   | yes            | authorised                                |
 * | granted   | no             | authorises NOTHING, passive re-confirm     |
 * | revoked   | either         | still refused, never re-asked              |
 * | absent    | n/a            | not consent, never asked twice             |
 *
 * An unrecognised state string (a row written by a future release) is treated as
 * "not granted": a caller deciding whether to process personal data fails closed.
 *
 * This is advisory for a UI. The analytics join binds the digest in SQL, so a
 * caller who forgets to call this still cannot count a stale grant.
 */
export function effectivePurposeGrant(
  current: CurrentPurposeConsent | null | undefined,
  liveScopeDigest: string,
): EffectivePurposeGrant {
  if (!current) return { authorised: false, needsReconfirmation: false };
  if (current.state !== 'granted') return { authorised: false, needsReconfirmation: false };
  const matches = current.scopeDigest === liveScopeDigest;
  return { authorised: matches, needsReconfirmation: !matches };
}

// --- Read -----------------------------------------------------------------------

export interface PurposeConsentEntry {
  purpose: ProcessingPurposeId;
  /** `'absent'` when the user has never acted on this purpose. */
  state: PurposeConsentState | 'absent';
  authorised: boolean;
  needsReconfirmation: boolean;
  scopeDigest: string | null;
  policyVersion: string | null;
  actedAt: Date | null;
  source: string | null;
  scopeSnapshot: PurposeScopeSnapshot | null;
}

export interface PurposeConsentStateContext {
  /** The live digest, from {@link currentPurposeScope}. */
  scopeDigest: string;
  /**
   * Which purposes to report on. Defaults to every registered purpose, so a
   * caller building a consent HISTORY sees a revoked-then-deferred purpose. A
   * route rendering `/settings/privacy` passes `scope.offerablePurposes`.
   */
  purposes?: readonly ProcessingPurposeId[];
}

/**
 * The user's current state for each purpose, with the live digest already
 * applied. One row per purpose is always returned, including purposes the user
 * has never acted on, so a caller never has to treat "absent" as a missing key.
 */
export async function getPurposeConsentState(
  db: DB,
  userId: string,
  ctx: PurposeConsentStateContext,
): Promise<PurposeConsentEntry[]> {
  const purposes = ctx.purposes ?? PROCESSING_PURPOSES;
  if (purposes.length === 0) return [];

  const rows = await db
    .select({
      purpose: userPurposeConsents.purpose,
      state: userPurposeConsents.state,
      scopeDigest: userPurposeConsents.scopeDigest,
      policyVersion: userPurposeConsents.policyVersion,
      actedAt: userPurposeConsents.actedAt,
      source: userPurposeConsents.source,
      scopeSnapshot: userPurposeConsents.scopeSnapshot,
    })
    .from(userPurposeConsents)
    .where(
      and(
        eq(userPurposeConsents.userId, userId),
        isNull(userPurposeConsents.supersededAt),
        inArray(userPurposeConsents.purpose, [...purposes]),
      ),
    );

  const byPurpose = new Map(rows.map((r) => [r.purpose, r]));

  return purposes.map((purpose) => {
    const row = byPurpose.get(purpose);
    const grant = effectivePurposeGrant(row, ctx.scopeDigest);
    const state: PurposeConsentState | 'absent' =
      row && isPurposeConsentState(row.state) ? row.state : 'absent';
    return {
      purpose,
      state,
      authorised: grant.authorised,
      needsReconfirmation: grant.needsReconfirmation,
      scopeDigest: row?.scopeDigest ?? null,
      policyVersion: row?.policyVersion ?? null,
      actedAt: row?.actedAt ?? null,
      source: row?.source ?? null,
      scopeSnapshot: row?.scopeSnapshot ?? null,
    };
  });
}

/**
 * The full append-only history for a user, newest first. Feeds the consent
 * history table on `/settings/privacy` and the DSAR `purposeConsents` section.
 */
export async function listPurposeConsentHistory(
  db: DB,
  userId: string,
): Promise<UserPurposeConsentRow[]> {
  const rows = await db
    .select()
    .from(userPurposeConsents)
    .where(eq(userPurposeConsents.userId, userId));
  // Sorted in JS rather than SQL: the row count per user is bounded by the
  // number of times a person can click a toggle, and `acted_at` alone is not a
  // total order (two purposes can share a timestamp), so the tiebreaker is the
  // id, exactly as a keyset order would be.
  return rows.sort((a, b) => {
    const delta = b.actedAt.getTime() - a.actedAt.getTime();
    return delta !== 0 ? delta : b.id.localeCompare(a.id);
  });
}

function isPurposeConsentState(value: string | undefined): value is PurposeConsentState {
  return value !== undefined && (PURPOSE_CONSENT_STATES as readonly string[]).includes(value);
}

function isProcessingPurposeId(value: string): value is ProcessingPurposeId {
  return (PROCESSING_PURPOSES as readonly string[]).includes(value);
}

// --- Write ----------------------------------------------------------------------

export interface RecordPurposeConsentInput {
  userId: string;
  purpose: ProcessingPurposeId;
  /** True to grant, false to withdraw. */
  grant: boolean;
  /**
   * The digest the CLIENT was shown. Must equal `scope.digest`, or the write is
   * refused with {@link PurposeScopeChangedError}: a grant recorded against a
   * disclosure the user never read is not consent.
   */
  scopeDigest: string;
  /** The live scope, from {@link currentPurposeScope}. */
  scope: PurposeScope;
  source: PurposeConsentSource;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RecordPurposeConsentResult {
  /** False when the incoming triple already matched the current row (a no-op). */
  written: boolean;
  state: PurposeConsentState;
  actedAt: Date;
  /** The new current row's id, or the existing one's on a deduped no-op. */
  consentId: string | null;
  scopeDigest: string;
  policyVersion: string;
}

/**
 * Record a grant or a withdrawal, supersede-then-insert, in ONE transaction.
 *
 * The prior current row gets `superseded_at = now()` and a new row is inserted.
 * Nothing is ever UPDATEd in place, so the history is complete and "current" is
 * the single row the partial unique index guarantees.
 *
 * The server supplies the policy version, the snapshot, the IP and the user
 * agent itself. The client supplies only the purpose, the direction and the
 * digest it was shown, for exactly the reason the terms route supplies its own
 * version: a client-supplied record of what a client claims it displayed is
 * worth nothing.
 *
 * Deduped on a GENUINE no-op only: the incoming `(state, scopeDigest,
 * policyVersion)` triple equalling the current row's. That is narrower than
 * `recordConsent`'s version-only dedup, which is what makes a grant, revoke,
 * grant sequence at one policy version three rows here and one row there.
 */
export async function recordPurposeConsent(
  db: DB,
  input: RecordPurposeConsentInput,
): Promise<RecordPurposeConsentResult> {
  if (!isProcessingPurposeId(input.purpose)) {
    throw new PurposeNotOfferedError(String(input.purpose));
  }

  // A WITHDRAWAL is never gated. A purpose can stop being offered (an operator
  // removes its last recipient) while a live grant exists, and a user who
  // cannot then turn it off has been trapped by a config change.
  if (input.grant && !input.scope.offerablePurposes.includes(input.purpose)) {
    throw new PurposeNotOfferedError(input.purpose);
  }

  // The digest handshake guards GRANTS only. "Degrade stale grants, honour
  // stale refusals": a grant recorded against a disclosure the user never read
  // is not consent, but refusing a WITHDRAWAL because the operator changed the
  // scope while the tab was open makes turning it off harder than turning it on,
  // which is exactly what Art. 7(3) forbids. The stored row carries the digest
  // that was actually in force, so the record stays honest either way.
  if (input.grant && input.scopeDigest !== input.scope.digest) {
    throw new PurposeScopeChangedError(input.scope.digest, input.scopeDigest);
  }

  const state: PurposeConsentState = input.grant ? 'granted' : 'revoked';
  const snapshot = buildPurposeScopeSnapshot(input.purpose, input.scope);
  const policyVersion = input.scope.policyVersion;

  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: userPurposeConsents.id,
          state: userPurposeConsents.state,
          scopeDigest: userPurposeConsents.scopeDigest,
          policyVersion: userPurposeConsents.policyVersion,
          actedAt: userPurposeConsents.actedAt,
        })
        .from(userPurposeConsents)
        .where(
          and(
            eq(userPurposeConsents.userId, input.userId),
            eq(userPurposeConsents.purpose, input.purpose),
            isNull(userPurposeConsents.supersededAt),
          ),
        )
        .limit(1);

      if (
        current
        && current.state === state
        && current.scopeDigest === input.scope.digest
        && current.policyVersion === policyVersion
      ) {
        return {
          written: false,
          state,
          actedAt: current.actedAt,
          consentId: current.id,
          scopeDigest: current.scopeDigest,
          policyVersion: current.policyVersion,
        };
      }

      if (current) {
        const superseded = await tx
          .update(userPurposeConsents)
          .set({ supersededAt: new Date() })
          .where(
            and(
              eq(userPurposeConsents.id, current.id),
              // Re-assert the predicate we selected on. If a concurrent writer
              // superseded this row between the SELECT and here, zero rows come
              // back and we must not insert a second current row.
              isNull(userPurposeConsents.supersededAt),
            ),
          )
          .returning({ id: userPurposeConsents.id });
        if (superseded.length === 0) throw new PurposeConsentConflictError(input.purpose);
      }

      const [inserted] = await tx
        .insert(userPurposeConsents)
        .values({
          userId: input.userId,
          purpose: input.purpose,
          state,
          scopeDigest: input.scope.digest,
          scopeSnapshot: snapshot,
          policyVersion,
          source: input.source,
          ipAddress: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        })
        .returning({ id: userPurposeConsents.id, actedAt: userPurposeConsents.actedAt });

      return {
        written: true,
        state,
        actedAt: inserted?.actedAt ?? new Date(),
        consentId: inserted?.id ?? null,
        scopeDigest: input.scope.digest,
        policyVersion,
      };
    });
  } catch (err: unknown) {
    if (err instanceof PurposeConsentError) throw err;
    // Appendix B16: two concurrent writes for one (user, purpose) both find no
    // current row, both insert, and one takes a unique violation on
    // `uq_purpose_current`. That is a lost race, not a broken server, so it
    // surfaces as a retryable 409 and never as a 500.
    if (isUniqueViolation(err)) throw new PurposeConsentConflictError(input.purpose);
    throw err;
  }
}

/**
 * Postgres 23505. Drizzle wraps the driver error, so the code can sit on the
 * error, on its cause, or only in the message; check all three (the same
 * detection `createNotification` uses).
 */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return (
    e?.code === '23505'
    || e?.cause?.code === '23505'
    || /23505|unique[_ ]violation|duplicate key/i.test(e?.message ?? '')
  );
}

// --- Compile-time parity guard --------------------------------------------------
// `PurposeScopeSnapshot` is declared in `packages/schema/src/persona.ts` (the
// table module cannot import `@commonpub/persona`, section 14.7) and validated
// here. Two hand-written mirrors of one shape drift (session 243), so these
// mutual assignments fail to compile if either side gains or loses a key.
// Type-only: erased at build.

interface ValidatedPurposeScopeSnapshot {
  purposeLabel: string;
  offSummary: string;
  onSummary: string;
  recipients: Array<{ id: string; name: string; relationship: string }>;
  dataClasses: string[];
  aggregatableFieldKeys: string[];
  policyVersion: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _snapshotParityForward: PurposeScopeSnapshot =
  null as unknown as ValidatedPurposeScopeSnapshot;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _snapshotParityBackward: ValidatedPurposeScopeSnapshot =
  null as unknown as PurposeScopeSnapshot;
