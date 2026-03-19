import { listContentVersions } from '@commonpub/server';
import type { ContentVersionItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentVersionItem[]> => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Content ID is required' });
  }

  return listContentVersions(db, id);
});
