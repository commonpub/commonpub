import { getUserByUsername, getOrCreateActorKeypair, findProfileGate, canViewProfile } from '@commonpub/server';

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

  // A non-public profile still needs an actor: its handle, inbox and key are
  // what lets its posts federate and its follows work. What it stops publishing
  // is the profile: the display name and bio (session 261). A remote server is a
  // signed-out viewer, so a members-only profile is treated the same way.
  const gate = await findProfileGate(db, username);
  const shown = !!gate && canViewProfile(gate, null);

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: actorUri,
    type: 'Person',
    preferredUsername: username,
    name: shown ? profile.displayName || username : username,
    summary: shown ? profile.bio || '' : '',
    inbox: `${actorUri}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    following: `${actorUri}/following`,
    url: `https://${domain}/u/${username}`,
    endpoints: {
      sharedInbox: `https://${domain}/inbox`,
    },
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
