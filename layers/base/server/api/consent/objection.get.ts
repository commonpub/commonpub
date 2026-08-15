/**
 * GET /api/consent/objection — where the logged-in member stands on community
 * statistics, and every sentence needed to describe that choice.
 *
 * THIS IS NOT A CONSENT ROUTE, and the separation is the point. Instance
 * statistics are anonymous totals the operator computes over its own members'
 * records, so they happen whether or not anybody agrees. Asking permission for
 * processing you would carry out regardless is a dark pattern with good
 * intentions, and it teaches people that the toggles mean nothing. So statistics
 * run on legitimate interest (Art. 6(1)(f)) and the member gets the instrument
 * that belongs to that basis: an OBJECTION (Art. 21).
 *
 * Consequences that are deliberate, each of which would be wrong on
 * `/api/consent/purposes`:
 *
 *  - NO SCOPE DIGEST and NO SNAPSHOT. A digest exists to lapse a GRANT when what
 *    it authorises changes, so the member is asked again against the new terms. A
 *    REFUSAL must survive exactly that change. "Degrade stale grants, honour
 *    stale refusals."
 *  - NO HISTORY. This is a current state, not an Art. 7(1) record of what was
 *    displayed when somebody agreed.
 *  - THE DEFAULT IS ON. A member with no record is counted, and the payload says
 *    so in its own words rather than leaving the page to invent them. Every
 *    consent card on this instance defaults OFF; this one is the exception and
 *    the copy has to be read as an objection, never dressed as consent.
 *
 * ROUTE CONTRACT. Scoped by the session user, always: there is no id in the path
 * and no id in a body, so one member can neither read nor set another's
 * standing. The state is in `user_statistics_objections`, one row at most, keyed
 * by the primary key, and its presence IS the objection.
 *
 * EVERY STRING BELOW COMES FROM THE REGISTRY in `@commonpub/persona`, through
 * `@commonpub/server`, exactly as the consent cards do. Nothing here paraphrases
 * the disclosure: a wording that can drift from the processing it describes is
 * the defect the registry exists to prevent.
 *
 * This module also exports the payload builder and the floor resolver, because
 * `objection.put.ts` has to answer with the SAME shape. Two hand-written copies
 * of one payload drift, and a status line that disagrees with the row it
 * describes is the one lie this surface cannot afford.
 */
import type { CommonPubConfig } from '@commonpub/config';
import {
  PERSONA_STATISTICS,
  STATISTICS_LEGAL_BASIS,
  type PersonaMetricsThresholds,
  type StatisticsObjection,
  type StatisticsObjectionState,
  dataSharingConfigSchema,
  getStatisticsObjection,
  renderStatisticsSummary,
  resolvePersonaThresholds,
} from '@commonpub/server';

export interface StatisticsObjectionPayload {
  /** `'counted'` is the state with no record on file. Absence is not a decision. */
  state: StatisticsObjectionState;
  /** `true` exactly when `state` is `'objected'`. */
  objected: boolean;
  /** ISO 8601, or null while the member is counted. Formatted on the reader's clock. */
  objectedAt: string | null;
  label: string;
  /**
   * `'legitimate_interest'`, never `'consent'`. Rendered beside the copy so a
   * surface cannot describe this as something the member agreed to, which is the
   * exact mistake being corrected.
   */
  legalBasis: typeof STATISTICS_LEGAL_BASIS;
  /**
   * What the instance does, rendered against THIS instance's k-anonymity floors.
   *
   * The registry carries a template naming `{minBucket}`, so a page that
   * substituted a plausible default would promise "at least five people" on an
   * instance whose SQL floor is 25 and understate the member's own protection by
   * five times. Only the server can resolve it, so only the server renders it.
   */
  description: string;
  /** Why there is no consent toggle here, said out loud rather than left to be noticed. */
  basisNote: string;
  /** The status line for the CURRENT state. What is true right now, read first. */
  statusSummary: string;
  /** The action while counted, and what it changes. */
  objectLabel: string;
  objectEffect: string;
  /** The way back, because an objection a member cannot lift is a trap. */
  withdrawObjectionLabel: string;
  withdrawObjectionEffect: string;
}

/**
 * The k-anonymity floors this instance actually runs, clamped to the package
 * constants exactly as every aggregate query clamps them.
 *
 * Read from the CONFIG FILE rather than from `effectiveDataSharingDocument`,
 * and that is not a shortcut: the effective document merges only the stored
 * RECIPIENT list over the file, and takes its floors from the same
 * `dataSharingConfigSchema` parse of `config.dataSharing` that this does. The
 * two therefore cannot disagree, and this route avoids four queries to learn one
 * number on a page load.
 *
 * A malformed document resolves to the schema defaults rather than throwing, for
 * the same reason `currentPurposeScope` does: a config typo that made it
 * impossible to RECORD AN OBJECTION would be a worse failure than a conservative
 * floor.
 */
export function statisticsFloors(config: CommonPubConfig): PersonaMetricsThresholds {
  const parsed = dataSharingConfigSchema.safeParse(config.dataSharing ?? {});
  return resolvePersonaThresholds(parsed.success ? parsed.data : null);
}

/**
 * Turn a stored standing into the sentences a member reads.
 *
 * BOTH directions' copy is sent, not only the one currently available. A member
 * deciding needs to read what the action would do, and a member who has already
 * objected needs to read what lifting it would restart; a payload carrying only
 * the applicable half would make the page hold the other half, which is where a
 * second copy of the disclosure would start.
 */
export function buildStatisticsObjectionPayload(
  objection: StatisticsObjection,
  floors: PersonaMetricsThresholds,
): StatisticsObjectionPayload {
  return {
    state: objection.state,
    objected: objection.objected,
    // ISO, never a locale string: the server's timezone is not the reader's, and
    // a server-formatted local date is the SSR hydration mismatch class.
    objectedAt: objection.objectedAt ? objection.objectedAt.toISOString() : null,
    label: PERSONA_STATISTICS.label,
    legalBasis: PERSONA_STATISTICS.legalBasis,
    description: renderStatisticsSummary(floors),
    basisNote: PERSONA_STATISTICS.basisNote,
    // From the service, which takes it from `statisticsStateSummary`, so the
    // status line cannot disagree with the row that produced it.
    statusSummary: objection.summary,
    objectLabel: PERSONA_STATISTICS.objectLabel,
    objectEffect: PERSONA_STATISTICS.objectEffect,
    withdrawObjectionLabel: PERSONA_STATISTICS.withdrawObjectionLabel,
    withdrawObjectionEffect: PERSONA_STATISTICS.withdrawObjectionEffect,
  };
}

export default defineEventHandler(async (event): Promise<StatisticsObjectionPayload> => {
  // The flag BEFORE auth, matching `/api/consent/purposes`: an anonymous probe
  // gets the same 404 whether or not the feature exists here.
  requireFeature('persona');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const objection = await getStatisticsObjection(db, user.id);
  return buildStatisticsObjectionPayload(objection, statisticsFloors(config));
});
