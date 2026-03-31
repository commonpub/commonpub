import { getRemoteActorProfile } from '@commonpub/server';
import type { RemoteActorProfile } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  uri: z.string().url(),
});

export default defineEventHandler(async (event): Promise<RemoteActorProfile> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { uri } = parseQueryParams(event, querySchema);

  const profile = await getRemoteActorProfile(db, uri, config.instance.domain, user.id);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Remote actor not found' });
  }

  return profile;
});
