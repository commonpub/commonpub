import { getFederatedHub, getFederatedHubPost, listFederatedHubPostReplies } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const { postId } = parseParams(event, { id: 'uuid', postId: 'uuid' });
  const query = getQuery(event);
  const db = useDB();

  // Gate on the post's parent-hub visibility (a hidden/unfollowed hub must stop
  // serving its posts' replies).
  const post = await getFederatedHubPost(db, postId);
  if (!post || !(await getFederatedHub(db, post.federatedHubId))) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub post not found' });
  }

  return listFederatedHubPostReplies(db, postId, {
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
