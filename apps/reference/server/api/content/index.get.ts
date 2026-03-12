import { listContent } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  return listContent(db, {
    status: query.status as string | undefined ?? 'published',
    type: query.type as string | undefined,
    featured: query.featured === 'true' ? true : undefined,
    difficulty: query.difficulty as string | undefined,
    search: query.search as string | undefined,
    tag: query.tag as string | undefined,
    sort: query.sort as 'recent' | 'popular' | 'featured' | undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
