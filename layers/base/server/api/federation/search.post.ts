import { searchRemoteActor } from '@commonpub/server';
import type { RemoteActorProfile } from '@commonpub/server';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(3).max(256),
});

export default defineEventHandler(async (event): Promise<RemoteActorProfile | null> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { query } = await parseBody(event, searchSchema);

  return searchRemoteActor(db, query, config.instance.domain, user.id);
});
