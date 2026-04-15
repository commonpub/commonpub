import { getHubBySlug, listHubResources } from '@commonpub/server';
import { AP_CONTEXT } from '@commonpub/protocol';

/**
 * Hub resources collection endpoint. Returns AP OrderedCollection for federation.
 * Only responds to ActivityPub clients (Accept: application/activity+json).
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) return;

  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) return;

  const slug = getRouterParam(event, 'slug');
  if (!slug) return;

  const db = useDB();
  const hub = await getHubBySlug(db, slug);
  if (!hub) return;

  const { items } = await listHubResources(db, hub.id);
  const domain = config.instance.domain;
  const collectionUri = `https://${domain}/hubs/${slug}/resources`;

  setResponseHeader(event, 'content-type', 'application/activity+json');
  return {
    '@context': AP_CONTEXT,
    type: 'OrderedCollection',
    id: collectionUri,
    totalItems: items.length,
    orderedItems: items.map((item) => ({
      type: 'cpub:Resource',
      id: `${collectionUri}/${item.id}`,
      name: item.title,
      url: item.url,
      summary: item.description ?? undefined,
      'cpub:category': item.category,
      'cpub:sortOrder': item.sortOrder,
    })),
  };
});
