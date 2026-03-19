import { shareContent, getHubBySlug } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { z } from 'zod';

const shareContentSchema = z.object({
  contentId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const body = await readBody(event);

  const parsed = shareContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return shareContent(db, user.id, hub.id, parsed.data.contentId);
});
