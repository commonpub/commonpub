import { getHubBySlug, createProduct } from '@commonpub/server';
import type { ProductDetail } from '@commonpub/server';
import { createProductSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ProductDetail> => {
  const db = useDB();
  const user = requireAuth(event);
  const slug = getRouterParam(event, 'slug');

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Hub slug is required' });
  }

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const body = await readBody(event);
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  return createProduct(db, user.id, hub.id, parsed.data);
});
