import { getFederatedHubPost } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const { postId } = parseParams(event, { postId: 'uuid' });

  const post = await getFederatedHubPost(db, postId);
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub post not found' });
  }

  return post;
});
