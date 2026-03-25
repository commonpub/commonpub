import { listContentProducts } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentProductItem[]> => {
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return listContentProducts(db, id);
});
