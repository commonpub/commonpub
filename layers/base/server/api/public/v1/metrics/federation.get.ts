import { getFederationReach } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/public/v1/metrics/federation
 *
 * Scope: read:federation. Federation reach: known instances, active mirrors,
 * accepted followers, and inbound content by origin domain (domain-level only,
 * never per-user).
 *
 * Double-gated: requires `features.federation` AND the opt-in
 * `features.publicApiMetricsFederation` (default OFF), because this exposes
 * network-topology data about third-party instances. 404 (not 403) when either
 * is off, so the surface stays invisible.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('publicApiMetricsFederation');
  requireApiScope(event, 'read:federation');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const db = useDB();
  return await getFederationReach(db, parsed.data.limit);
});
