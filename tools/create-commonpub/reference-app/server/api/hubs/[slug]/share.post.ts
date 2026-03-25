import { shareContent, getHubBySlug } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { z } from 'zod';

const shareContentSchema = z.object({
  contentId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, shareContentSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const post = await shareContent(db, user.id, hub.id, input.contentId);
  if (!post) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot share. You must be a hub member and the content must exist.' });
  }
  return post;
});
