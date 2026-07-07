import { getFeaturedHub } from '@commonpub/server';
import type { HubListItem } from '@commonpub/server';

/**
 * GET /api/hubs/featured
 * The operator-chosen featured hub (rendered as a full-width hero atop the hubs
 * listing), or null. Public. Returns null when the `featuredHub` feature is off
 * so the client never renders a hero the operator hasn't enabled.
 */
export default defineEventHandler(async (): Promise<{ featured: HubListItem | null }> => {
  const config = useConfig();
  if (!config.features.featuredHub) return { featured: null };
  const db = useDB();
  return { featured: await getFeaturedHub(db) };
});
