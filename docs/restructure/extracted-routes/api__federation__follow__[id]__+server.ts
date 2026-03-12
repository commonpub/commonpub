import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unfollowRemote } from '$lib/server/federation';
import { eq } from 'drizzle-orm';
import { followRelationships } from '@commonpub/schema';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.config.features.federation) {
    return json({ error: 'Federation is not enabled' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const relationship = await locals.db
    .select()
    .from(followRelationships)
    .where(eq(followRelationships.id, params.id))
    .limit(1);

  if (relationship.length === 0) {
    return json({ error: 'Follow relationship not found' }, { status: 404 });
  }

  // Ownership check: only the follower can delete their own follow
  const localActorUri = `https://${locals.config.instance.domain}/users/${locals.user.username}`;
  if (relationship[0]!.followerActorUri !== localActorUri) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  await unfollowRemote(
    locals.db,
    locals.user.id,
    relationship[0]!.followingActorUri,
    locals.config.instance.domain,
  );

  return json({ success: true });
};
