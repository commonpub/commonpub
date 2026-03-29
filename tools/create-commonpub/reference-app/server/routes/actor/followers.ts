import { getFollowers } from '@commonpub/server';

/**
 * Instance actor followers collection.
 * Returns remote actors that follow this instance (for mirroring).
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const db = useDB();
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/actor`;

  let followers: string[] = [];
  try {
    const result = await getFollowers(db, actorUri);
    followers = result.map((f) => f.followerActorUri);
  } catch {
    // Federation tables may not exist yet
  }

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${actorUri}/followers`,
    type: 'OrderedCollection',
    totalItems: followers.length,
    orderedItems: followers,
  };
});
