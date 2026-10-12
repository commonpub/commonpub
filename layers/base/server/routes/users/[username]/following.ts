import { getUserByUsername, findProfileGate, canViewProfile, getFollowing } from '@commonpub/server';

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

  let following: string[] = [];
  try {
    const result = await getFollowing(db, actorUri);
    following = result.map((f) => f.followingActorUri);
  } catch {
    // May not have federation tables
  }

  const gate = await findProfileGate(db, username);
  const listed = !!gate && canViewProfile(gate, null);

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${actorUri}/following`,
    type: 'OrderedCollection',
    totalItems: following.length,
    // A non-public profile keeps its count but not the names (session 261). A
    // remote server is a signed-out viewer, so members-only hides them too.
    orderedItems: listed ? following : [],
  };
});
