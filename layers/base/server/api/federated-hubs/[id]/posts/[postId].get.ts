import { getFederatedHub, getFederatedHubPost } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const { postId } = parseParams(event, { postId: 'uuid' });

  const post = await getFederatedHubPost(db, postId);
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub post not found' });
  }

  // Gate on the post's OWN parent-hub visibility (a hidden/unfollowed hub must
  // stop serving its posts). Resolve via the post's federatedHubId rather than the
  // path :id so a visible-hub id in the URL can't unlock a hidden hub's post.
  const hub = await getFederatedHub(db, post.federatedHubId);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub post not found' });
  }

  return post;
});
