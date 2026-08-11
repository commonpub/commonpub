import { getHubBySlug, listHubProducts, toPageMeta } from '@commonpub/server';
import type { PaginatedPage, ProductListItem } from '@commonpub/server';
import { z } from 'zod';
import { productStatusSchema, productCategorySchema } from '@commonpub/schema';

const productQuerySchema = z.object({
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedPage<ProductListItem>> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug } = parseParams(event, { slug: 'string' });
  const filters = parseQueryParams(event, productQuerySchema);

  const hub = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }
  requireHubReadAccess(event, hub);

  const result = await listHubProducts(db, hub.id, filters);
  return {
    ...result,
    ...toPageMeta({
      total: result.total,
      returned: result.items.length,
      limit: filters.limit ?? 20,
      offset: filters.offset ?? 0,
    }),
  };
});
