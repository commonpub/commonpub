import { toggleLockPost, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });

  const community = await getHubBySlug(db, slug);
  if (!community) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const result = await toggleLockPost(db, postId, user.id, community.id);
  if (!result) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });
  return result;
});
