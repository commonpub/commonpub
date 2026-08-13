/**
 * GET /api/public/v1/metrics/persona/audience
 *
 * Scope: `read:audience`. Quantised audience sizes per processing purpose, from
 * the most recent FINALISED UTC day (plan 7.4). Counts only, never a roster: no
 * endpoint in this family returns the MEMBERS of a consenting cohort, and
 * member-level disclosure is a separate feature needing its own flag, one key per
 * named recipient, a `disclosure_events` row per disclosure, a fourth purpose,
 * and a deletion-surviving tombstone.
 *
 * It carries a THIRD feature gate, `dataSharingConsents`, on top of the two its
 * siblings use, because this is the surface that reports what members agreed to
 * beyond being counted.
 *
 * Two things it deliberately does not do:
 *
 * - It never publishes a structural zero. A purpose nobody can grant yet reports
 *   `{ available: false, reason: 'purpose_not_offered' }`, because a zero meaning
 *   "not implemented" reads identically to a zero meaning "nobody opted in"
 *   (audit B9). In this release `recruiter_visibility` and `sponsor_sharing` are
 *   exactly that case.
 * - It never counts somebody into a statistic nobody described to them. A user
 *   appears in `openToRecruiters` only when they hold a current, digest-matching
 *   grant for BOTH `profile_analytics` and `recruiter_visibility`, because only
 *   the `profile_analytics` copy says "your answers are counted in group totals".
 */
import { getAudienceCounts, type PersonaAudienceCounts } from '@commonpub/server';

// Relative, not auto-imported: Nitro routes do not auto-import from `utils/`.
import { personaMetricsContext } from '../../../../../utils/personaMetricsContext';


export default defineEventHandler(async (event): Promise<PersonaAudienceCounts> => {
  requireFeature('persona');
  requireFeature('personaAnalytics');
  requireFeature('dataSharingConsents');
  requireApiScope(event, 'read:audience');

  const db = useDB();
  const config = useConfig();

  const { scope, thresholds } = await personaMetricsContext(db, config);

  return await getAudienceCounts(db, {
    thresholds,
    scopeDigest: scope.digest,
    source: 'rollup',
    offeredPurposes: scope.offerablePurposes.map((purpose) => ({
      purpose,
      scopeDigest: scope.digest,
    })),
  });
});
