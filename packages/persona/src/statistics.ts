import type { PersonaDataClass, PurposeCopyContext } from './purposes.js';

/**
 * Community statistics: the one thing this instance does with persona answers
 * that is NOT a consent question, and the member's instrument against it.
 *
 * WHY THIS IS NOT A PURPOSE. `profile_analytics` used to sit in the purpose
 * registry as "count my answers in community statistics", and it was wrong in a
 * way that is easy to miss because it looked generous. The instance holds those
 * numbers regardless: they are anonymous totals over its own members, computed
 * from records it already has, by the party that already controls them. Asking
 * permission for processing you would carry out whether or not the answer is yes
 * is a dark pattern with good intentions, and it is worse than not asking,
 * because it teaches people that the toggles mean nothing.
 *
 * So statistics run on legitimate interest (Art. 6(1)(f)) and the member gets
 * the right that belongs to that basis: an OBJECTION (Art. 21). Offering the
 * objection plainly, and honouring it in the query, is what makes the basis
 * defensible rather than merely convenient. A member with an objection on record
 * is skipped by every aggregate, which is the same shape the consent join used
 * to have, inverted.
 *
 * WHY IT IS A SEPARATE MODULE. Consent and objection are different legal acts
 * with different lifecycles, different storage and different histories. Folding
 * an objection into `user_purpose_consents` as a third state would have made the
 * consent history unreadable and the scope digest meaningless: a digest exists to
 * invalidate a GRANT when what it authorises changes, and a refusal must survive
 * exactly that change. Nothing here goes through the purpose registry.
 *
 * WHAT GATES THE COPY. None of this is shown on an instance that computes no
 * statistics. An operator can run persona for purely operational questions, with
 * every sharing and analytics flag off, and then a screen mentioning group totals
 * describes something that does not happen there. This module supplies the words;
 * the surface that renders them checks the flag first.
 */

/**
 * The Art. 6 basis, stated once and rendered beside the copy.
 *
 * Its own constant so a surface cannot describe statistics as consent, which is
 * the exact mistake being corrected here.
 */
export const STATISTICS_LEGAL_BASIS = 'legitimate_interest';

/**
 * Where a member stands. `counted` is the state with no record on file, so the
 * absence of a row is the absence of an objection, and the default cannot drift
 * by somebody editing a default value.
 */
export const STATISTICS_OBJECTION_STATES = ['counted', 'objected'] as const;

export type StatisticsObjectionState = (typeof STATISTICS_OBJECTION_STATES)[number];

export interface StatisticsDisclosureSpec {
  readonly label: string;
  readonly legalBasis: typeof STATISTICS_LEGAL_BASIS;
  /**
   * Literal: totals stay here. A statistic that left this instance would be a
   * disclosure to a named recipient, which is a consent purpose and lives in
   * `purposes.ts`.
   */
  readonly disclosedTo: 'this_instance';
  /**
   * The data classes the totals are built from, in the same vocabulary the
   * consent cards use. `getPersonaLinkPresence` counts which link platforms a
   * member lists (never the addresses), which is why `profile_links` is here as
   * well as `persona_selections`.
   */
  readonly covers: readonly PersonaDataClass[];
  /**
   * What the instance does, as a TEMPLATE. It names the operator's own bucket
   * floor, which is configurable, so it cannot be a finished sentence. Render it
   * with {@link renderStatisticsSummary}.
   *
   * Tokens: `{minBucket}`, `{minPopulation}`.
   */
  readonly summaryTemplate: string;
  /** Why there is no toggle here, said out loud rather than left to be noticed. */
  readonly basisNote: string;
  /** The status line while the member is counted, which is the default state. */
  readonly countedSummary: string;
  /** The status line once an objection is on record. */
  readonly objectedSummary: string;
  /** The action, phrased as the member's choice and not as a preference. */
  readonly objectLabel: string;
  /** What objecting changes, and what it cannot undo. */
  readonly objectEffect: string;
  /** The way back, because an objection a member cannot lift is a trap. */
  readonly withdrawObjectionLabel: string;
  /** What lifting the objection starts again. */
  readonly withdrawObjectionEffect: string;
  /**
   * Literal `false`, not `boolean`: shipping a build that pre-objects on a
   * member's behalf is a typecheck failure, not a test failure. It sounds
   * protective and is not. An objection is the member's act, recorded as theirs,
   * and one nobody made is one nobody can be shown to have made.
   */
  readonly defaultObjected: false;
}

/**
 * The copy is the product here exactly as it is on a consent card. Same house
 * register: what is true right now before what changes, plain words, the
 * operator's real floor rather than a hardcoded five, no exclamation marks, and
 * the thing that cannot be undone said in the same breath as the thing that can.
 */
export const PERSONA_STATISTICS = {
  label: 'Community statistics',
  legalBasis: STATISTICS_LEGAL_BASIS,
  disclosedTo: 'this_instance',
  covers: ['persona_selections', 'profile_links'],
  // The private-profile exclusion is disclosed here for the same reason it was
  // disclosed on the old consent card: the aggregate query filters on a public
  // profile, so a member who goes private stops being counted without being
  // told. A number that quietly excludes you is not the number you were shown.
  // The link sentence is not garnish: the link-presence aggregate counts which
  // platforms a member lists, so `profile_links` is in `covers` and the copy has
  // to name it or the description is narrower than the processing.
  summaryTemplate:
    'This site counts your answers, and which link platforms you list but never the addresses, into group totals that show what its community is made of. No total names anyone: one appears only once at least {minBucket} people give the same answer, and counts are rounded down. While your profile is private your answers are not counted at all.',
  /**
   * Rewritten in the session-255 UX pass. The old wording opened "These are the
   * site keeping count of its own members", which has no working subject and
   * shipped that way, and spent 41 words saying what 30 say. Every fact is
   * kept: not consent, happens regardless, the instrument is objection, and the
   * objection reaches the totals rather than sitting in a preference table.
   */
  basisNote:
    'This is not a consent question: the site counts its own members either way. What you have instead is the right to object, and objecting is honoured in the numbers.',
  countedSummary: 'Right now your answers are counted in group totals. No total names you.',
  objectedSummary:
    'Right now you are left out of statistics. Your answers are not counted in any new group total.',
  objectLabel: 'Leave me out of statistics entirely',
  objectEffect:
    'Objecting stops your answers being counted in new totals, usually within a day. Totals already published are not recalculated, so it cannot remove you from those. Your answers stay in your account.',
  withdrawObjectionLabel: 'Include me in statistics again',
  withdrawObjectionEffect:
    'Your answers are counted in totals from then on. Totals published while you were left out are not recalculated either.',
  defaultObjected: false,
} satisfies StatisticsDisclosureSpec;

/**
 * Render the statistics copy against the floors actually in force.
 *
 * THE only way to turn `summaryTemplate` into a sentence, for the same reason
 * `renderPurposeOnSummary` is: one operator setting implies the SQL floor and the
 * sentence that names it, so it keys into one substitution rather than into two
 * declarations that drift.
 */
export function renderStatisticsSummary(ctx: PurposeCopyContext): string {
  return PERSONA_STATISTICS.summaryTemplate
    .replaceAll('{minBucket}', String(ctx.minBucket))
    .replaceAll('{minPopulation}', String(ctx.minPopulation));
}

/** The status line for where this member currently stands. */
export function statisticsStateSummary(state: StatisticsObjectionState): string {
  return state === 'objected'
    ? PERSONA_STATISTICS.objectedSummary
    : PERSONA_STATISTICS.countedSummary;
}

/**
 * Is `dataClass` part of what the totals are built from?
 *
 * The counterpart of `purposeCovers`, and load bearing for the same reason: the
 * link-presence aggregate asserts the class it reads, so an aggregate cannot
 * outrun the sentence a member was shown. If a future edit narrows `covers`, that
 * surface goes dark rather than quietly counting something undisclosed.
 */
export function statisticsCovers(dataClass: PersonaDataClass): boolean {
  return (PERSONA_STATISTICS.covers as readonly string[]).includes(dataClass);
}
