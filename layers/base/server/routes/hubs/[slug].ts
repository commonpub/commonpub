import { buildHubGroupActor } from '@commonpub/server';

/**
 * Hub Group actor endpoint. Returns AP Group JSON-LD for federation.
 * Only responds to ActivityPub clients (Accept: application/activity+json).
 * Browser requests pass through to the Nuxt page handler.
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  // Only handle AP requests — let browser requests fall through to the page handler
  if (!isAPRequest) return;

  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) return;

  const slug = getRouterParam(event, 'slug');
  if (!slug) return;

  const db = useDB();
  const actor = await buildHubGroupActor(db, slug, config.instance.domain);
  if (!actor) return;

  setResponseHeader(event, 'content-type', 'application/activity+json');
  return actor;
});
