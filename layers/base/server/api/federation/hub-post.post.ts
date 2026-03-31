import { sendPostToRemoteHub } from '@commonpub/server';
import { z } from 'zod';

const hubPostSchema = z.object({
  federatedHubId: z.string().uuid(),
  hubActorUri: z.string().url(),
  content: z.string().min(1).max(10000),
  type: z.string().optional().default('text'),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const body = await parseBody(event, hubPostSchema);

  const success = await sendPostToRemoteHub(
    db,
    user.id,
    user.username,
    body.hubActorUri,
    body.content,
    config.instance.domain,
    body.type,
  );

  if (!success) {
    throw createError({ statusCode: 502, statusMessage: 'Could not reach remote hub' });
  }

  return { success };
});
