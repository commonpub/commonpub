import { searchProducts } from '@commonpub/server';
import type { PaginatedResponse, ProductListItem } from '@commonpub/server';
import { productStatusSchema, productCategorySchema } from '@commonpub/schema';
import { z } from 'zod';

const productSearchSchema = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  hubId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<ProductListItem>> => {
  const db = useDB();
  const query = productSearchSchema.parse(getQuery(event));

  return searchProducts(db, {
    search: query.q ?? query.search,
    category: query.category,
    status: query.status,
    hubId: query.hubId,
    limit: query.limit,
    offset: query.offset,
  });
});
