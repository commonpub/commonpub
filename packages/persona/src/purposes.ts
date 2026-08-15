import { fnv1a32 } from './digest.js';

/**
 * Every processing purpose a member can be ASKED about, which is now exactly one
 * shape: NAMED THIRD-PARTY EXPOSURE. Something about the member leaves this
 * instance and reaches a party the operator has declared, by name, with a
 * privacy policy to link.
 *
 * Instance statistics are deliberately not here. The instance counts answers
 * over its own members whether or not anybody agrees, because they are anonymous
 * totals about its own records, so dressing that as a consent toggle was asking
 * permission for processing that happens regardless. It runs on legitimate
 * interest with an objection instead; `statistics.ts` holds that instrument and
 * its copy. Consent and objection are different legal acts with different
 * lifecycles, which is why they are different modules and different tables.
 *
 * Each id is at most 24 characters, so it fits `user_purpose_consents.purpose
 * varchar(24)` (migration 0046). A test asserts it.
 *
 * ADDING A THIRD PURPOSE: one entry here, one in `PROCESSING_PURPOSE_SPECS` with
 * its copy, one id in the recipient's `purposes`, and it appears. No schema, no
 * migration. Speculating one before a real recipient needs it would be cruft
 * rather than foresight, so there are two.
 */
export const PROCESSING_PURPOSES = ['recruiter_visibility', 'sponsor_sharing'] as const;

export type ProcessingPurposeId = (typeof PROCESSING_PURPOSES)[number];

/**
 * The classes of persona data a purpose can cover. Coarse on purpose: a class is
 * what a person can hold in their head while reading a consent card.
 *
 * Shared with `statistics.ts`, which declares the classes the instance's own
 * totals are built from. One vocabulary, so "what is counted" and "what is
 * disclosed" are stated in the same words and can be compared.
 */
export const PERSONA_DATA_CLASSES = [
  'persona_selections',
  'profile_links',
  'location_coarse',
  'public_identity',
] as const;

export type PersonaDataClass = (typeof PERSONA_DATA_CLASSES)[number];

/**
 * A named party that persona data may be disclosed to.
 *
 * Hand-written here so this module stays free of a Zod import cycle;
 * `dataRecipientSchema` in `schemas.ts` carries a compile-time parity guard
 * against this interface, so the two cannot drift.
 */
export interface DataRecipient {
  id: string;
  name: string;
  url?: string;
  /** Required: you cannot disclose to a party with no policy to link. */
  privacyPolicyUrl: string;
  purposes: ProcessingPurposeId[];
  relationship: 'processor' | 'joint_controller' | 'independent_controller';
  /** URL or reference to the signed Art. 26 / Art. 28 instrument. */
  agreementRef?: string;
  country?: string;
  transferMechanism?: 'adequacy' | 'scc' | 'bcr' | 'derogation';
}

export interface ProcessingPurposeSpec {
  readonly label: string;
  /** What is true while it is OFF. Rendered FIRST, always, and asserted by test. */
  readonly offSummary: string;
  /**
   * What starts happening if it is turned on, as a TEMPLATE.
   *
   * It is not the finished sentence, and the name says so, because a purpose
   * whose copy names one of the operator's k-anonymity floors has to name the
   * configured number rather than a hardcoded one. A "at least five people" on
   * an instance running `minBucket: 25` understates the member's own protection
   * by five times, and the stored Art. 7(1) snapshot then carries the wrong
   * number as the record of what they were shown.
   *
   * Neither purpose here names a floor today, because both disclose one named
   * member to one named recipient and a floor over a group has nothing to say
   * about that. The indirection stays anyway: {@link renderPurposeOnSummary} is
   * the ONE way to turn a template into a sentence, so the rendered card and the
   * stored snapshot cannot diverge, and a future purpose that does name a floor
   * cannot bypass it. `statistics.ts` uses the same tokens, and its copy does
   * name the floor.
   *
   * Tokens: `{minBucket}`, `{minPopulation}`.
   */
  readonly onSummaryTemplate: string;
  /**
   * The data classes this purpose authorises processing of.
   *
   * Load bearing, not decorative: it is what `currentPurposeScope` digests into
   * the scope digest and what `buildPurposeScopeSnapshot` stores as the record
   * of what the member agreed to. A disclosure that sends a class absent from
   * the granting purpose's `covers` is processing outside its consent, so a new
   * field in a new class is a `covers` edit AND a copy edit, both of which move
   * the digest and re-ask everyone who already agreed.
   */
  readonly covers: readonly PersonaDataClass[];
  /**
   * Literal, not a union: every purpose in this registry is an exposure to a
   * party outside this instance. That is the whole reason the registry exists
   * after `profile_analytics` left it. Processing this instance does with its
   * own records is not a consent question and does not belong here; widening
   * this type is the deliberate act that would let one in.
   */
  readonly disclosedTo: 'named_recipients';
  /**
   * The Art. 6 lawful basis, rendered on the consent card beside the copy.
   * Every purpose here is consent; the field exists so a future
   * legitimate-interest purpose cannot be added without the card saying so.
   */
  readonly legalBasis: 'consent';
  readonly revocationEffect: string;
  /**
   * What happens to the ANSWERS after a revocation: they stay in the member's
   * account, and what stops is the processing.
   *
   * It does NOT say "on your profile", because after the `showOnProfile`
   * inversion most answers are not on a profile at all. A reassurance that
   * describes a place the data is not would be worse than no reassurance.
   */
  readonly answersAfterRevocation: 'kept_in_your_account';
  readonly requiresRecipients: boolean;
  /**
   * Literal `false`, not `boolean`: shipping a purpose that defaults on is a
   * typecheck failure, not a test failure.
   */
  readonly defaultGranted: false;
}

/**
 * `satisfies`, not `as`: a missing purpose is a typecheck failure and the
 * literal keeps its narrow types.
 *
 * The copy is the product. Every sentence here is rendered verbatim on the
 * consent card, on the privacy page and in the stored consent snapshot, so
 * changing behaviour without changing this text is not possible without the
 * change being visible.
 */
export const PROCESSING_PURPOSE_SPECS = {
  recruiter_visibility: {
    label: 'Let people hiring find me by my answers',
    offSummary:
      'Right now nobody outside this site can find you through the hiring directory, and none of your answers are sent to anyone.',
    // Every class in `covers` is named in this sentence, because the sentence is
    // the record of what the member agreed to. `public_identity` is the name and
    // profile, `profile_links` the addresses on it, `location_coarse` the town,
    // `persona_selections` the interests and tech stack.
    onSummaryTemplate:
      'If you turn this on: your name, your public profile, the links on it, the town you list and your answers about interests and tech stack are shown to the people named below when they search this site for someone to hire. Each time one of them looks you up it is recorded and shown to you. They cannot see your email address.',
    covers: ['persona_selections', 'public_identity', 'profile_links', 'location_coarse'],
    disclosedTo: 'named_recipients',
    legalBasis: 'consent',
    // "It cannot recall what was already shared" is the honest sentence and it
    // stays. Promising more than the architecture delivers is the failure the
    // whole surface exists to avoid.
    revocationEffect:
      'You can turn this off at any time, and new searches stop finding you straight away. It cannot recall what was already shared: somebody who looked you up keeps whatever they noted down. Your answers stay in your account.',
    answersAfterRevocation: 'kept_in_your_account',
    requiresRecipients: true,
    defaultGranted: false,
  },
  sponsor_sharing: {
    label: 'Share my answers with contest sponsors',
    offSummary:
      'Right now nothing about you is shared with sponsors, and no sponsor is told you are here.',
    onSummaryTemplate:
      'If you turn this on: your answers about interests and tech stack, and the links on your profile, are sent to the sponsors named below. Each of them keeps its own copy under its own privacy policy, linked beside its name, and this site cannot delete their copy for you.',
    covers: ['persona_selections', 'profile_links'],
    disclosedTo: 'named_recipients',
    legalBasis: 'consent',
    revocationEffect:
      'You can turn this off at any time, and nothing further is sent. It cannot recall what was already shared: a sponsor that already has your answers keeps them under its own policy, and you would ask that sponsor directly. Your answers stay in your account.',
    answersAfterRevocation: 'kept_in_your_account',
    requiresRecipients: true,
    defaultGranted: false,
  },
} satisfies Record<ProcessingPurposeId, ProcessingPurposeSpec>;

/**
 * Cap on one rendered consent sentence.
 *
 * Declared here rather than beside the snapshot validator because the copy is
 * written here and the RENDERED copy (the template with its widest possible
 * substitution) is what has to fit. `PURPOSE_SCOPE_SNAPSHOT_CAPS` imports it, so
 * a sentence that would be rejected at write time fails a unit test in this
 * package first, where the author can see it.
 */
export const PURPOSE_COPY_MAX_LENGTH = 400;

/**
 * The resolved k-anonymity floors the consent copy has to state.
 *
 * Structural so `PurposeScope` and `PersonaMetricsThresholds` both satisfy it
 * without this package learning either type.
 */
export interface PurposeCopyContext {
  readonly minBucket: number;
  readonly minPopulation: number;
}

/**
 * Render a purpose's on-state copy against the floors actually in force.
 *
 * THE only way to turn `onSummaryTemplate` into a sentence. "Derive, do not
 * declare twice": one operator setting implies the SQL floor, the rendered card
 * and the stored consent record, so it keys into one substitution here rather
 * than into three independent declarations that silently drift.
 */
export function renderPurposeOnSummary(
  id: ProcessingPurposeId,
  ctx: PurposeCopyContext,
): string {
  return PROCESSING_PURPOSE_SPECS[id].onSummaryTemplate
    .replaceAll('{minBucket}', String(ctx.minBucket))
    .replaceAll('{minPopulation}', String(ctx.minPopulation));
}

/**
 * Does `purpose` authorise processing `dataClass`?
 *
 * The point of exporting this is that `covers` stops being decorative: the
 * surface that discloses a class asserts that class against the purpose it joins
 * on, so a disclosure cannot silently outrun the sentence the member read. It
 * has already caught one real case, where a link aggregate ran off a grant whose
 * copy named only interests and tech stack.
 */
export function purposeCovers(
  purpose: ProcessingPurposeId,
  dataClass: PersonaDataClass,
): boolean {
  return (PROCESSING_PURPOSE_SPECS[purpose].covers as readonly string[]).includes(dataClass);
}

export interface PurposeOfferabilityContext {
  readonly recipients: readonly DataRecipient[];
  /** Purposes whose READ surface exists. A purpose absent here is never offered. */
  readonly enabledPurposes: readonly ProcessingPurposeId[];
}

/**
 * A purpose that cannot yet do anything is not offered, not listed on
 * `/settings/privacy`, and not listed in the derived privacy-page section.
 * Nothing is collected that cannot yet be acted on, which is what Art. 4(11)
 * specificity requires and what keeps the one ask a user will read from being
 * spent on nothing.
 *
 * There is no aggregatable-field gate any more. It existed for one purpose,
 * `profile_analytics`, which is gone: statistics are not a consent question, so
 * "there is nothing countable yet" can no longer be a reason a CONSENT card is
 * withheld. What every purpose here needs is a recipient, and one with its
 * paperwork.
 */
export function purposeIsOfferable(
  id: ProcessingPurposeId,
  ctx: PurposeOfferabilityContext,
): boolean {
  if (!ctx.enabledPurposes.includes(id)) return false;

  const spec = PROCESSING_PURPOSE_SPECS[id];

  const covering = ctx.recipients.filter((r) => r.purposes.includes(id));
  if (spec.requiresRecipients && covering.length === 0) return false;

  // An operator cannot deploy past an unpapered onward transfer. A joint or
  // independent controller with no agreement reference makes the purpose
  // unofferable rather than making the disclosure quietly.
  const unpapered = covering.some(
    (r) => r.relationship !== 'processor' && !r.agreementRef,
  );
  if (unpapered) return false;

  return true;
}

/**
 * Whether the scope digest is sensitive to which aggregatable FIELD KEYS exist,
 * as opposed to only the data classes and recipients.
 *
 * Appendix B10 leaves this open, and the two answers trade real things against
 * each other. `true` means a grant tracks exactly which closed-vocabulary
 * answers exist to be disclosed: adding one degrades every existing grant and
 * puts a re-confirm card in front of every consenting member. `false` means a
 * new field inside an already-consented data class is treated as covered, and
 * members are re-asked only when a class or a recipient changes, which avoids
 * training people to click through consent.
 *
 * The reading is if anything stronger now than when it was written for counting.
 * Both surviving purposes SEND a member's selections to a named third party, so
 * "which selections exist" is part of what leaves, not merely part of what is
 * tallied.
 *
 * Shipped as `true`, the conservative reading. It is the DEFAULT of a real
 * input rather than a module constant, so both branches are reachable and
 * testable without a constant-guarded test, and reversing the decision is still
 * one edit plus a documented re-prompt.
 */
export const DIGEST_INCLUDES_FIELD_KEYS = true;

export interface PurposeScopeDigestInput {
  policyVersion: string;
  dataClasses: readonly string[];
  recipientIds: readonly string[];
  aggregatableFieldKeys: readonly string[];
  /** Defaults to {@link DIGEST_INCLUDES_FIELD_KEYS}. See its docblock. */
  includeFieldKeys?: boolean;
}

/**
 * A stable digest of everything a grant is given against.
 *
 * Each part is tagged with its group AND newline-terminated before hashing.
 * `fnv1a32` hashes its parts as one stream (its own test pins that
 * `['a','b']` and `['ab']` collide), so the tag alone is not enough: without a
 * separator `['rc:ab','rc:c']` and `['rc:a','brc:c']` hash identically, and
 * `policyVersion` is a free operator-controlled string. A newline cannot appear
 * in a tagged part, so it is a genuine delimiter here.
 *
 * Lists are sorted and deduped, so declaration order in a config file does not
 * invalidate consent.
 *
 * Computed SERVER SIDE only, unlike the cookie digest, because it is bound into
 * a SQL predicate and the client's view of config can legitimately lag.
 */
export function purposeScopeDigest(input: PurposeScopeDigestInput): string {
  const includeFieldKeys = input.includeFieldKeys ?? DIGEST_INCLUDES_FIELD_KEYS;
  const tagged = (tag: string, values: readonly string[]): string[] =>
    Array.from(new Set(values))
      .sort()
      .map((v) => `${tag}:${v}\n`);

  const parts: string[] = [
    `pv:${input.policyVersion}\n`,
    ...tagged('dc', input.dataClasses),
    ...tagged('rc', input.recipientIds),
    ...(includeFieldKeys ? tagged('fk', input.aggregatableFieldKeys) : []),
  ];

  return fnv1a32(parts);
}
