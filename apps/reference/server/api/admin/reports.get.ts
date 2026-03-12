import { listReports } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const query = getQuery(event);

  return listReports(db, {
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
