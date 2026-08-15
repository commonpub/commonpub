/**
 * GET /api/public/v1/metrics/persona/links
 *
 * Scope: `read:audience`. How many consenting members list each link platform,
 * from the most recent FINALISED UTC day (plan 7.2, 7.4).
 *
 * Counted from `users.social_links`, the seven keys that already exist, because
 * v1 deliberately does not normalise them into a `user_profile_links` table
 * (plan 14.4). That cutover would change the public API serializer, the DSAR
 * allow-list, the profile DTO, the settings form and the Drizzle type, all for a
 * query speed that a once-a-day rollup makes moot.
 *
 * `authenticitySignal` is a REGISTRY FACT carried by each platform, not a
 * hardcoded list inside a query: an operator who declares a platform decides its
 * signal status once, where they name it.
 *
 * No query parameters. A `limit` here would silently drop platforms from a list
 * whose `suppressed` count is only meaningful against the whole set, so the
 * bound is the platform registry itself.
 */
import { getPersonaLinkPresence, type PersonaLinkPresence } from '@commonpub/server';

// Relative, not auto-imported: Nitro routes do not auto-import from `utils/`.
import { personaMetricsContext } from '../../../../../utils/personaMetricsContext';


export default defineEventHandler(async (event): Promise<PersonaLinkPresence> => {
  requireFeature('persona');
  requireFeature('personaAnalytics');
  // Every count here is a count of purpose GRANTS, and `dataSharingConsents`
  // governs the surface where those are given and withdrawn. The counting must
  // not outlive the surface: see `server/plugins/persona-rollup.ts`.
  requireFeature('dataSharingConsents');
  requireApiScope(event, 'read:audience');

  const db = useDB();
  const config = useConfig();

  const { platforms, scope, thresholds } = await personaMetricsContext(db, config);

  return await getPersonaLinkPresence(db, {
    thresholds,
    scopeDigest: scope.digest,
    source: 'rollup',
    platforms,
  });
});
