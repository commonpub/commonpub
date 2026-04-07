import { listFederatedHubPostReplies } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const postId = getRouterParam(event, 'postId')!;
  const query = getQuery(event);
  const db = useDB();

  return listFederatedHubPostReplies(db, postId, {
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
