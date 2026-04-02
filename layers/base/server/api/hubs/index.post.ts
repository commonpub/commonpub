import { createHub, federateHubActor } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import { createHubSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createHubSchema);

  const hub = await createHub(db, user.id, input);

  // Federate new hub as Group actor Announce (fire-and-forget)
  if (config.features.federation && config.features.federateHubs) {
    federateHubActor(db, hub.id, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate hub actor:', err);
    });
  }

  return hub;
});
