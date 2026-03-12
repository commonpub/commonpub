import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { AP_CONTEXT } from '@commonpub/protocol';
import { getFollowing } from '$lib/server/federation';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  const rows = await locals.db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, params.username))
    .limit(1);

  if (rows.length === 0) {
    error(404, 'User not found');
  }

  const domain = locals.config.instance.domain;
  const actorUri = `https://${domain}/users/${params.username}`;
  const following = await getFollowing(locals.db, actorUri);

  return json(
    {
      '@context': AP_CONTEXT,
      type: 'OrderedCollection',
      id: `${actorUri}/following`,
      totalItems: following.length,
      orderedItems: following.map((f) => f.followingActorUri),
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
};
