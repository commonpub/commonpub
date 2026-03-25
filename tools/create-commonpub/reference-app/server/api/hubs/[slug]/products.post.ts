import { getHubBySlug, createProduct } from '@commonpub/server';
import type { ProductDetail } from '@commonpub/server';
import { createProductSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ProductDetail> => {
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const input = await parseBody(event, createProductSchema);

  return createProduct(db, user.id, hub.id, input);
});
