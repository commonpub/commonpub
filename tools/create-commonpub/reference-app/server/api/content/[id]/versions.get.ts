import { listContentVersions } from '@commonpub/server';
import type { ContentVersionItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentVersionItem[]> => {
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return listContentVersions(db, id);
});
