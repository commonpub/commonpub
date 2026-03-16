import { createPost, getCommunityBySlug } from '@commonpub/server';
import { createPostSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const body = await readBody(event);
  const community = await getCommunityBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const parsed = createPostSchema.safeParse({ communityId: community.id, ...body });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createPost(db, user.id, { communityId: community.id, ...body });
});
