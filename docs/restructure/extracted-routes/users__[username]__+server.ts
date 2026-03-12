import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { buildKeyId, type CommonPubActor } from '@commonpub/protocol';
import { getOrCreateActorKeypair } from '$lib/server/federation';

export const GET: RequestHandler = async ({ params, request, locals }) => {
  const accept = request.headers.get('accept') ?? '';
  const wantsAP =
    accept.includes('application/activity+json') || accept.includes('application/ld+json');

  if (!wantsAP) {
    // Redirect to HTML profile page
    return new Response(null, {
      status: 302,
      headers: { Location: `/@${params.username}` },
    });
  }

  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  const rows = await locals.db
    .select()
    .from(users)
    .where(eq(users.username, params.username))
    .limit(1);

  if (rows.length === 0) {
    error(404, 'User not found');
  }

  const user = rows[0]!;
  const domain = locals.config.instance.domain;
  const actorUri = `https://${domain}/users/${user.username}`;

  const keypair = await getOrCreateActorKeypair(locals.db, user.id);

  const actor: CommonPubActor = {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    type: 'Person',
    id: actorUri,
    preferredUsername: user.username,
    name: user.displayName ?? undefined,
    summary: user.bio ?? undefined,
    url: `https://${domain}/@${user.username}`,
    inbox: `${actorUri}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    following: `${actorUri}/following`,
    publicKey: {
      id: buildKeyId(domain, user.username),
      owner: actorUri,
      publicKeyPem: keypair.publicKeyPem,
    },
    endpoints: {
      sharedInbox: `https://${domain}/inbox`,
      oauthAuthorizationEndpoint: `https://${domain}/api/auth/oauth2/authorize`,
      oauthTokenEndpoint: `https://${domain}/api/auth/oauth2/token`,
    },
  };

  if (user.avatarUrl) {
    actor.icon = { type: 'Image', url: user.avatarUrl };
  }

  return json(actor, {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};
