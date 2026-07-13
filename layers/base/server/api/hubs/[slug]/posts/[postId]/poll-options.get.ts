import { getPollOptions, getUserPollVote, getHubBySlug, getPostById } from '@commonpub/server';

/**
 * GET /api/hubs/:slug/posts/:postId/poll-options
 * Get poll options and the user's vote (if authenticated).
 */
export default defineEventHandler(async (event) => {
  requireFeature('hubs');
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });

  // Gate on hub privacy before exposing a private hub's poll (P-1b): the sibling
  // replies route was patched but this one only checked requireFeature('hubs'),
  // so a private-hub poll's options + tallies were readable unauthenticated.
  const hub = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  requireHubReadAccess(event, hub);

  const post = await getPostById(db, postId);
  if (!post || post.hubId !== hub.id) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  const options = await getPollOptions(db, postId);
  const userVote = user ? await getUserPollVote(db, postId, user.id) : null;

  return { options, userVote };
});
