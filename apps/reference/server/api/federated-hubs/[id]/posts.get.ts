import { listFederatedHubPosts } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const query = getQuery(event);

  return listFederatedHubPosts(db, id, {
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
