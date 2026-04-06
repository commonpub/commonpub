import { resolveRemoteActor } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  uri: z.string().url(),
});

/**
 * Resolve a remote AP URI to a displayable resource.
 * Used by /authorize_interaction to show what the user is about to follow.
 */
export default defineEventHandler(async (event): Promise<{ type: string; name: string; url: string }> => {
  requireFeature('federation');
  requireAuth(event);
  const db = useDB();
  const { uri } = await parseBody(event, schema);

  const actor = await resolveRemoteActor(db, uri);
  if (actor) {
    const actorType = (actor as Record<string, unknown>).type as string || 'Person';
    const name = (actor as Record<string, unknown>).name as string
      || (actor as Record<string, unknown>).preferredUsername as string
      || uri;
    return {
      type: actorType === 'Group' ? 'Hub' : actorType,
      name,
      url: uri,
    };
  }

  return { type: 'unknown', name: uri, url: uri };
});
