import { listContentProducts } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';

/**
 * GET /api/content/:id/products — the bill of materials linked to a content item.
 *
 * The visibility gate lives inside `listContentProducts`, so every caller
 * inherits it rather than each route remembering. This route only supplies the
 * viewer: absent means the anonymous view (published + public), which is what an
 * unauthenticated caller gets.
 *
 * A hidden item yields an empty list rather than a 404, matching the shape every
 * other public list read on this instance returns and revealing nothing about
 * whether the id exists.
 */
export default defineEventHandler(async (event): Promise<ContentProductItem[]> => {
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return listContentProducts(db, id, getOptionalUser(event)?.id);
});
