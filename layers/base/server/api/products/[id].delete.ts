import { deleteProduct } from '@commonpub/server';
import { products } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event): Promise<{ deleted: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Owner OR moderator may delete. Resolve the product's owner first.
  const [product] = await db
    .select({ createdById: products.createdById })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  if (!ownerOrPermission(event, product.createdById, 'content.moderate')) {
    throw createError({ statusCode: 403, statusMessage: 'Missing permission: content.moderate' });
  }

  // Pass userId for an owner-scoped data-layer delete; moderators (non-owners)
  // are already gated above, so they delete unconditionally.
  const isOwner = product.createdById === user.id;
  const deleted = await deleteProduct(db, id, isOwner ? user.id : undefined);

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  return { deleted: true };
});
