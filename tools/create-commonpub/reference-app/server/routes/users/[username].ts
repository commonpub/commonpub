import { getUserByUsername, getOrCreateActorKeypair } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')!;
  const accept = getRequestHeader(event, 'accept') || '';

  // Only serve AP actor for ActivityPub clients
  if (!accept.includes('application/activity+json') && !accept.includes('application/ld+json')) {
    // Redirect browsers to the profile page
    return sendRedirect(event, `/u/${username}`);
  }

  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Actor not found' });
  }

  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;

  let publicKeyPem = '';
  try {
    const keypair = await getOrCreateActorKeypair(db, profile.id);
    publicKeyPem = keypair.publicKeyPem;
  } catch {
    // Key generation may fail if crypto is unavailable
  }

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: actorUri,
    type: 'Person',
    preferredUsername: username,
    name: profile.displayName || username,
    summary: profile.bio || '',
    inbox: `${actorUri}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    following: `${actorUri}/following`,
    url: `https://${domain}/u/${username}`,
    ...(publicKeyPem
      ? {
          publicKey: {
            id: `${actorUri}#main-key`,
            owner: actorUri,
            publicKeyPem,
          },
        }
      : {}),
  };
});
