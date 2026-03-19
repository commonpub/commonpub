import { deletePost, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<boolean> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const postId = getRouterParam(event, 'postId')!;
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return deletePost(db, postId, user.id, community.id);
});
