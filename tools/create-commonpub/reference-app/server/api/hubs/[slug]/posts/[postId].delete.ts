import { deletePost, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<boolean> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return deletePost(db, postId, user.id, community.id);
});
