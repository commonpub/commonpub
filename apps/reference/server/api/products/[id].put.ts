import { updateProduct } from '@commonpub/server';
import type { ProductDetail } from '@commonpub/server';
import { updateProductSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ProductDetail> => {
  const db = useDB();
  const user = requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Product ID is required' });
  }

  const body = await readBody(event);
  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  const product = await updateProduct(db, id, user.id, parsed.data);

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  return product;
});
