import { createPost, getHubBySlug } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { createPostSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const body = await readBody(event);
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const parsed = createPostSchema.safeParse({ hubId: community.id, ...body });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createPost(db, user.id, parsed.data);
});
