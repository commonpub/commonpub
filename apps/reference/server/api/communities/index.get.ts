import { listCommunities } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  return listCommunities(db, {
    search: query.search as string | undefined,
    joinPolicy: query.joinPolicy as string | undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
