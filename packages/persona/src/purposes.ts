import { fnv1a32 } from './digest.js';

/**
 * Every processing purpose a user can be asked about. Each id is at most 24
 * characters, so it fits `user_purpose_consents.purpose varchar(24)` (migration
 * 0046). A test asserts it.
 *
 * The bound originally existed for a `'sharing:' + id` row in `user_consents`;
 * plan 14.4 removed that row rather than `ALTER` a live GDPR table, so the
 * column this bound now serves is persona's own.
 */
export const PROCESSING_PURPOSES = [
  'profile_analytics',
  'recruiter_visibility',
  'sponsor_sharing',
] as const;

export type ProcessingPurposeId = (typeof PROCESSING_PURPOSES)[number];

/**
 * The classes of persona data a purpose can cover. Coarse on purpose: a class is
 * what a person can hold in their head while reading a consent card.
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
   * It is not the finished sentence, and the name says so, because the copy
   * names the operator's k-anonymity floor and that floor is configurable. A
   * hardcoded "at least five people" on an instance running `minBucket: 25`
   * understates the member's own protection by five times, and the stored Art.
   * 7(1) snapshot then carries the wrong number as the record of what they were
   * shown. Render it with {@link renderPurposeOnSummary}; the type forces every
   * consumer through that function, so the resolved floor, the rendered card,
   * the stored snapshot and the SQL `HAVING` cannot diverge.
   *
   * Tokens: `{minBucket}`, `{minPopulation}`.
   */
  readonly onSummaryTemplate: string;
  /**
   * The data classes this purpose authorises processing of.
   *
   * Load bearing, not decorative: it is what `currentPurposeScope` digests into
   * the scope digest and what `buildPurposeScopeSnapshot` stores as the record
   * of what the member agreed to. An aggregate that reads a class absent from
   * the granting purpose's `covers` is processing outside its consent, so a new
   * aggregate over a new class is a `covers` edit AND a copy edit, both of which
   * move the digest and re-ask everyone who already agreed.
   */
  readonly covers: readonly PersonaDataClass[];
  readonly disclosedTo: 'this_instance' | 'named_recipients';
  /**
   * The Art. 6 lawful basis, rendered on the consent card beside the copy.
   * Every purpose here is consent; the field exists so a future
   * legitimate-interest purpose cannot be added without the card saying so.
   */
  readonly legalBasis: 'consent';
  readonly revocationEffect: string;
  /**
   * What happens to the ANSWERS after a revocation. They stay on the user's own
   * profile; what stops is the processing.
   */
  readonly answersAfterRevocation: 'kept_on_your_profile';
  readonly requiresRecipients: boolean;
  readonly requiresAggregatableField: boolean;
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
  profile_analytics: {
    label: 'Count my answers in community statistics',
    offSummary:
      'Right now your answers are only visible on your profile and are not counted anywhere.',
    // Appendix B3: the aggregation query filters on a public profile, so a user
    // who grants this and later makes their profile private is silently not
    // counted. The exclusion is disclosed here, in the same sentence block that
    // promises the counting, and again inline on the toggle.
    //
    // The link sentence is not optional garnish: `getPersonaLinkPresence`
    // aggregates `users.social_links` off THIS grant, so `profile_links` is in
    // `covers` and the copy has to name it or the record misstates the scope.
    onSummaryTemplate:
      'If you turn this on: your interests, your tech stack and which link platforms you list (never the addresses) are counted in group totals. Totals are shown only when at least {minBucket} people share an answer, and counts are rounded down. Your name is never attached and nothing about you leaves this site. While your profile is set to private, your answers are not counted, even with this turned on.',
    covers: ['persona_selections', 'profile_links'],
    disclosedTo: 'this_instance',
    legalBasis: 'consent',
    revocationEffect:
      'You can turn this off at any time. Turning it off stops your answers being counted in new statistics, usually within a day. Statistics already published for past days are group totals and are not recalculated. Your answers stay on your profile until you change or delete them.',
    answersAfterRevocation: 'kept_on_your_profile',
    requiresRecipients: false,
    requiresAggregatableField: true,
    defaultGranted: false,
  },
  recruiter_visibility: {
    label: 'Let people hiring see my profile in the members directory',
    offSummary:
      'Right now nobody outside this site can see your profile through the hiring directory.',
    onSummaryTemplate:
      'If you turn this on: people the operator has approved for hiring can see what is already on your public profile, including the links on it and the town you list, plus your interests and tech stack. They cannot see your email address. They contact you through messages on this site.',
    covers: ['persona_selections', 'public_identity', 'profile_links', 'location_coarse'],
    disclosedTo: 'named_recipients',
    legalBasis: 'consent',
    revocationEffect:
      'You can turn this off at any time. Your answers stay on your profile.',
    answersAfterRevocation: 'kept_on_your_profile',
    requiresRecipients: true,
    requiresAggregatableField: false,
    defaultGranted: false,
  },
  sponsor_sharing: {
    label: 'Share my answers with contest sponsors',
    offSummary: 'Right now nothing about you is shared with sponsors.',
    onSummaryTemplate:
      'If you turn this on: your interests, your tech stack and your public profile links are shared with the sponsors named below. Each of these has a privacy policy linked below.',
    covers: ['persona_selections', 'profile_links'],
    disclosedTo: 'named_recipients',
    legalBasis: 'consent',
    revocationEffect:
      'You can turn this off at any time. Your answers stay on your profile.',
    answersAfterRevocation: 'kept_on_your_profile',
    requiresRecipients: true,
    requiresAggregatableField: false,
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
 * The point of exporting this is that `covers` stops being decorative: an
 * aggregate asserts the class it reads against the purpose it joins on, so a
 * future aggregate cannot silently outrun the disclosure the member read. The
 * one place this already went wrong (link presence counted under a purpose whose
 * copy named only interests and tech stack) is exactly what it now prevents.
 */
export function purposeCovers(
  purpose: ProcessingPurposeId,
  dataClass: PersonaDataClass,
): boolean {
  return (PROCESSING_PURPOSE_SPECS[purpose].covers as readonly string[]).includes(dataClass);
}

export interface PurposeOfferabilityContext {
  readonly recipients: readonly DataRecipient[];
  readonly aggregatableFieldKeys: readonly string[];
  /** Purposes whose READ surface exists. A purpose absent here is never offered. */
  readonly enabledPurposes: readonly ProcessingPurposeId[];
}

/**
 * A purpose that cannot yet do anything is not offered, not listed on
 * `/settings/privacy`, and not listed in the derived privacy-page section.
 * Nothing is collected that cannot yet be acted on, which is what Art. 4(11)
 * specificity requires and what keeps the one ask a user will read from being
 * spent on nothing.
 */
export function purposeIsOfferable(
  id: ProcessingPurposeId,
  ctx: PurposeOfferabilityContext,
): boolean {
  if (!ctx.enabledPurposes.includes(id)) return false;

  const spec = PROCESSING_PURPOSE_SPECS[id];

  if (spec.requiresAggregatableField && ctx.aggregatableFieldKeys.length === 0) {
    return false;
  }

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
 * each other. `true` means consent tracks exactly what is counted: adding an
 * aggregatable field degrades every existing `profile_analytics` grant and puts
 * a re-confirm card in front of every consenting user. `false` means a new field
 * inside an already-consented data class is treated as covered, and users are
 * re-asked only when a class or a recipient changes, which avoids training
 * people to click through consent.
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
