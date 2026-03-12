import { listContent } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  const q = query.q as string | undefined;
  if (!q) {
    return { items: [], total: 0 };
  }

  return listContent(db, {
    status: 'published',
    search: q,
    type: query.type as string | undefined,
    limit: query.limit ? Number(query.limit) : 20,
    offset: query.offset ? Number(query.offset) : 0,
  });
});
