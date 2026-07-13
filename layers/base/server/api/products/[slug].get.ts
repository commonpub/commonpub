import { getProductBySlug } from '@commonpub/server';
import type { ProductDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ProductDetail> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug } = parseParams(event, { slug: 'string' });

  // Thread the requester so a PRIVATE hub's product (and the hub id/name/slug it
  // discloses) is served only to a member / platform admin (P-1b).
  const product = await getProductBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  return product;
});
