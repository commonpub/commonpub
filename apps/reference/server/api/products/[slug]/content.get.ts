import { getProductBySlug, listProductContent } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });


  const product = await getProductBySlug(db, slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  const query = parseQueryParams(event, querySchema);
  return listProductContent(db, product.id, query);
});
