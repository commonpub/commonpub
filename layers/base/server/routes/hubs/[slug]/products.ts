import { getHubBySlug, listHubProducts } from '@commonpub/server';
import { AP_CONTEXT } from '@commonpub/protocol';

/**
 * Hub products collection endpoint. Returns AP OrderedCollection for federation.
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

  const { items } = await listHubProducts(db, hub.id);
  const domain = config.instance.domain;
  const collectionUri = `https://${domain}/hubs/${slug}/products`;

  setResponseHeader(event, 'content-type', 'application/activity+json');
  return {
    '@context': AP_CONTEXT,
    type: 'OrderedCollection',
    id: collectionUri,
    totalItems: items.length,
    orderedItems: items.map((item) => ({
      type: 'cpub:Product',
      id: `https://${domain}/products/${item.slug}`,
      name: item.name,
      summary: item.description ?? undefined,
      url: item.purchaseUrl ?? `https://${domain}/products/${item.slug}`,
      ...(item.imageUrl ? { image: { type: 'Image', url: item.imageUrl } } : {}),
      'cpub:category': item.category ?? undefined,
      'cpub:status': item.status,
    })),
  };
});
