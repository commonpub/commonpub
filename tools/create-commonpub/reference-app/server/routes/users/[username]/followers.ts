import { getUserByUsername, getFollowers } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')!;
  const db = useDB();
  const config = useConfig();

  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Actor not found' });
  }

  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;

  let followers: string[] = [];
  try {
    const result = await getFollowers(db, actorUri);
    followers = result.map((f) => f.followerActorUri);
  } catch {
    // May not have federation tables
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
