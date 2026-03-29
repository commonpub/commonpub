import { getFollowing } from '@commonpub/server';

/**
 * Instance actor following collection.
 * Returns remote actors that this instance follows (mirrors).
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const db = useDB();
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/actor`;

  let following: string[] = [];
  try {
    const result = await getFollowing(db, actorUri);
    following = result.map((f) => f.followingActorUri);
  } catch {
    // Federation tables may not exist yet
  }

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${actorUri}/following`,
    type: 'OrderedCollection',
    totalItems: following.length,
    orderedItems: following,
  };
});
