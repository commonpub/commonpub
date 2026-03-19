import { getProductBySlug } from '@commonpub/server';
import type { ProductDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ProductDetail> => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug');

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' });
  }

  const product = await getProductBySlug(db, slug);

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  return product;
});
