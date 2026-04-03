import { getHubBySlug, getHubFederatedFollowers, getHubActorUri } from '@commonpub/server';
import { hubMembers, users } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Hub Group actor followers/members collection.
 * Returns an OrderedCollection of both local members (as Person actor URIs)
 * and remote AP followers. Remote instances use this to populate member lists.
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

  // Get remote AP followers
  const followers = await getHubFederatedFollowers(db, hub.id);
  const followerUris = followers.map((f) => f.followerActorUri);

  // Get local hub members as Person actor URIs
  const localMembers = await db
    .select({ username: users.username })
    .from(hubMembers)
    .innerJoin(users, eq(hubMembers.userId, users.id))
    .where(and(eq(hubMembers.hubId, hub.id), eq(hubMembers.status, 'active')));
  const memberUris = localMembers.map((m) => `https://${domain}/users/${m.username}`);

  // Combine and deduplicate
  const allUris = [...new Set([...memberUris, ...followerUris])];

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${hubActorUri}/followers`,
    type: 'OrderedCollection',
    totalItems: allUris.length,
    orderedItems: allUris,
  };
});
