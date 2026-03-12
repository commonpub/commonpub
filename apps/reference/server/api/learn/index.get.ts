import { listPaths } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  return listPaths(db, {
    status: query.status as string | undefined ?? 'published',
    difficulty: query.difficulty as string | undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
