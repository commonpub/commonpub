import { getProductBySlug, listProductContent } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug } = parseParams(event, { slug: 'string' });

  // Thread the requester so a private-hub product's content gallery is members-only,
  // consistent with the product detail route (P-1b).
  const product = await getProductBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  const query = parseQueryParams(event, querySchema);
  return listProductContent(db, product.id, query);
});
