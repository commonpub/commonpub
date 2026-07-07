import { updateHub, getHubBySlug, federateHubUpdate } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import { updateHubSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const input = await parseBody(event, updateHubSchema);

  // Platform-admin (root) override: an instance admin can edit any community's
  // settings without being a hub member. `hasPermission` is non-throwing and
  // admin-floored, so full admins pass regardless of hub membership.
  const asPlatformAdmin = hasPermission(event, 'admin.access');

  const updated = await updateHub(db, hub.id, user.id, input, { asPlatformAdmin });
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to update this hub' });
  }

  // Federate the hub metadata update (fire-and-forget)
  if (config.features.federation && config.features.federateHubs) {
    federateHubUpdate(db, hub.id, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate hub update:', err);
    });
  }

  return updated;
});
