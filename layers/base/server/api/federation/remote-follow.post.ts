import { sendFollow, resolveRemoteActor } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  uri: z.string().url(),
});

/**
 * Follow a remote actor by URI. Used by /authorize_interaction.
 * Resolves the actor, then sends an AP Follow activity.
 */
export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { uri } = await parseBody(event, schema);

  // Resolve actor to ensure it's cached
  const actor = await resolveRemoteActor(db, uri);
  if (!actor) {
    throw createError({ statusCode: 404, statusMessage: 'Could not resolve remote actor' });
  }

  await sendFollow(db, user.id, uri, config.instance.domain);
  return { success: true };
});
