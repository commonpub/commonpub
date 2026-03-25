import { getHubBySlug, listHubProducts } from '@commonpub/server';
import type { PaginatedResponse, ProductListItem } from '@commonpub/server';
import { z } from 'zod';
import { productStatusSchema, productCategorySchema } from '@commonpub/schema';

const productQuerySchema = z.object({
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<ProductListItem>> => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const filters = parseQueryParams(event, productQuerySchema);


  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return listHubProducts(db, hub.id, filters);
});
