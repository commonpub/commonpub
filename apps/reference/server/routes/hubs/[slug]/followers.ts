import { getHubBySlug, getHubFederatedFollowers, getHubActorUri } from '@commonpub/server';

/**
 * Hub Group actor followers collection.
 * Returns an OrderedCollection of remote actors following this hub.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const db = useDB();
  const domain = config.instance.domain;

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const hubActorUri = getHubActorUri(domain, slug);
  const followers = await getHubFederatedFollowers(db, hub.id);
  const followerUris = followers.map((f) => f.followerActorUri);

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${hubActorUri}/followers`,
    type: 'OrderedCollection',
    totalItems: followerUris.length,
    orderedItems: followerUris,
  };
});
