import { getPostById, getHubBySlug, hasLikedPost } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });

  const community = await getHubBySlug(db, slug);
  if (!community) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const post = await getPostById(db, postId);
  if (!post || post.hubId !== community.id) throw createError({ statusCode: 404, statusMessage: 'Post not found' });

  const liked = user ? await hasLikedPost(db, user.id, postId) : false;
  return { ...post, isLiked: liked };
});
