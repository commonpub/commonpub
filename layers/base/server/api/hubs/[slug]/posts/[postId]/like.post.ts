import { likePost, unlikePost, hasLikedPost, getHubBySlug, getPostById, federateHubPostLike, federateHubPostUnlike, checkBan } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });

  const community = await getHubBySlug(db, slug);
  if (!community) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const post = await getPostById(db, postId);
  if (!post || post.hubId !== community.id) throw createError({ statusCode: 404, statusMessage: 'Post not found' });

  // Banned users cannot like posts
  const ban = await checkBan(db, community.id, user.id);
  if (ban) throw createError({ statusCode: 403, statusMessage: 'You are banned from this hub' });

  const alreadyLiked = await hasLikedPost(db, user.id, postId);
  if (alreadyLiked) {
    await unlikePost(db, user.id, postId);
    // Federate the unlike (fire-and-forget)
    if (config.features.federation && config.features.federateHubs) {
      federateHubPostUnlike(db, user.id, postId, slug, config.instance.domain).catch((err) => {
        console.error('[hub-federation] Failed to federate post unlike:', err);
      });
    }
    return { liked: false };
  }
  await likePost(db, user.id, postId);

  // Federate the like (fire-and-forget)
  if (config.features.federation && config.features.federateHubs) {
    federateHubPostLike(db, user.id, postId, slug, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate post like:', err);
    });
  }

  return { liked: true };
});
