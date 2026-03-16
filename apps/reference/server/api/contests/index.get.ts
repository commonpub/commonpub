import { listContests } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);
  return listContests(db, {
    status: query.status as string | undefined,
    limit: query.limit ? Number(query.limit) : 20,
    offset: query.offset ? Number(query.offset) : 0,
  });
});
