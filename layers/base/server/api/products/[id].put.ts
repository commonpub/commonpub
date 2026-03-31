import { updateProduct } from '@commonpub/server';
import type { ProductDetail } from '@commonpub/server';
import { updateProductSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ProductDetail> => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, updateProductSchema);

  const product = await updateProduct(db, id, user.id, input);

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  return product;
});
