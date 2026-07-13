import { eq, and, desc, sql, ilike, inArray, notInArray } from 'drizzle-orm';
import {
  products,
  contentProducts,
  contentItems,
  hubs,
  hubMembers,
  users,
} from '@commonpub/schema';
import type { DB, UserRef } from '../types.js';
import { generateSlug } from '../utils.js';
import { ensureUniqueSlugFor, USER_REF_SELECT, normalizePagination, countRows, escapeLike } from '../query.js';
import { visibleContentWhere } from '../content/visibility.js';

// --- Types ---

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  purchaseUrl: string | null;
  status: string;
  hubId: string;
  createdAt: Date;
}

export interface ProductDetail extends ProductListItem {
  specs: Record<string, string> | null;
  datasheetUrl: string | null;
  alternatives: Array<{ productId: string; reason: string }> | null;
  pricing: { min?: number; max?: number; currency?: string; asOf?: string } | null;
  updatedAt: Date;
  createdBy: UserRef;
  hub: { id: string; name: string; slug: string; hubType: string };
}

export interface ContentProductItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  quantity: number;
  role: string | null;
  notes: string | null;
  required: boolean;
  sortOrder: number;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  hubId?: string;
  status?: 'active' | 'discontinued' | 'preview';
  limit?: number;
  offset?: number;
}

// --- Product CRUD ---

export async function createProduct(
  db: DB,
  userId: string,
  hubId: string,
  input: {
    name: string;
    description?: string;
    category?: string;
    specs?: Record<string, string>;
    imageUrl?: string;
    purchaseUrl?: string;
    datasheetUrl?: string;
    pricing?: { min?: number; max?: number; currency?: string };
    status?: 'active' | 'discontinued' | 'preview';
  },
): Promise<ProductDetail> {
  // Verify user is an active hub member (any role) before allowing product
  // creation. Pending join requests (status != 'active') do not count.
  const [member] = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId), eq(hubMembers.status, 'active')))
    .limit(1);

  if (!member) {
    throw new Error('Must be a hub member to add products');
  }

  const slug = await ensureUniqueSlugFor(db, products, products.slug, products.id, generateSlug(input.name), 'product');

  const [product] = await db
    .insert(products)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      hubId,
      category: input.category as typeof products.category.enumValues[number] | undefined,
      specs: input.specs ?? null,
      imageUrl: input.imageUrl ?? null,
      purchaseUrl: input.purchaseUrl ?? null,
      datasheetUrl: input.datasheetUrl ?? null,
      pricing: input.pricing ?? null,
      status: input.status ?? 'active',
      createdById: userId,
    })
    .returning();

  // Internal write-confirmation re-fetch: bypass the P-1b private-hub read gate
  // (`asPlatformAdmin`) so creating a product in a PRIVATE hub still returns the
  // created row to its creator (who already passed the member check above).
  return (await getProductBySlug(db, product!.slug, userId, { asPlatformAdmin: true }))!;
}

export async function updateProduct(
  db: DB,
  productId: string,
  userId: string,
  input: {
    name?: string;
    description?: string;
    category?: string;
    specs?: Record<string, string>;
    imageUrl?: string;
    purchaseUrl?: string;
    datasheetUrl?: string;
    pricing?: { min?: number; max?: number; currency?: string };
    status?: string;
  },
): Promise<ProductDetail | null> {
  const existing = await db
    .select({ id: products.id, createdById: products.createdById })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (existing.length === 0) return null;
  if (existing[0]!.createdById !== userId) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = await ensureUniqueSlugFor(db, products, products.slug, products.id, generateSlug(input.name), 'product', productId);
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.specs !== undefined) updates.specs = input.specs;
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;
  if (input.purchaseUrl !== undefined) updates.purchaseUrl = input.purchaseUrl;
  if (input.datasheetUrl !== undefined) updates.datasheetUrl = input.datasheetUrl;
  if (input.pricing !== undefined) updates.pricing = input.pricing;
  if (input.status !== undefined) updates.status = input.status;

  await db.update(products).set(updates).where(eq(products.id, productId));

  const updated = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  // Internal write-confirmation re-fetch: bypass the P-1b private-hub read gate so a
  // private-hub product edit returns the updated row to its creator.
  return getProductBySlug(db, updated[0]!.slug, userId, { asPlatformAdmin: true });
}

export async function deleteProduct(
  db: DB,
  productId: string,
  userId?: string,
): Promise<boolean> {
  if (userId) {
    const existing = await db
      .select({ createdById: products.createdById })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (existing.length === 0 || existing[0]!.createdById !== userId) return false;
  }
  const result = await db.delete(products).where(eq(products.id, productId)).returning({ id: products.id });
  return result.length > 0;
}

export async function getProductBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
  opts?: { asPlatformAdmin?: boolean },
): Promise<ProductDetail | null> {
  const rows = await db
    .select({
      product: products,
      createdBy: USER_REF_SELECT,
      hub: {
        id: hubs.id,
        name: hubs.name,
        slug: hubs.slug,
        hubType: hubs.hubType,
      },
      hubPrivacy: hubs.privacy,
    })
    .from(products)
    .innerJoin(users, eq(products.createdById, users.id))
    .innerJoin(hubs, eq(products.hubId, hubs.id))
    .where(eq(products.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;

  // A private hub's product (and the private hub's id/name/slug/hubType it discloses)
  // is members-only (P-1b), mirroring the hub products route's requireHubReadAccess.
  // Serve iff the hub isn't private, OR the requester is a platform admin, OR the
  // requester holds an active membership. 404 (null) otherwise.
  if (row.hubPrivacy === 'private' && !opts?.asPlatformAdmin) {
    const isMember = requesterId
      ? (
          await db
            .select({ userId: hubMembers.userId })
            .from(hubMembers)
            .where(
              and(
                eq(hubMembers.hubId, row.product.hubId),
                eq(hubMembers.userId, requesterId),
                eq(hubMembers.status, 'active'),
              ),
            )
            .limit(1)
        ).length > 0
      : false;
    if (!isMember) return null;
  }

  return {
    id: row.product.id,
    name: row.product.name,
    slug: row.product.slug,
    description: row.product.description,
    category: row.product.category,
    imageUrl: row.product.imageUrl,
    purchaseUrl: row.product.purchaseUrl,
    datasheetUrl: row.product.datasheetUrl,
    specs: row.product.specs,
    alternatives: row.product.alternatives,
    pricing: row.product.pricing,
    status: row.product.status,
    hubId: row.product.hubId,
    createdAt: row.product.createdAt,
    updatedAt: row.product.updatedAt,
    createdBy: row.createdBy,
    hub: row.hub,
  };
}

export async function listHubProducts(
  db: DB,
  hubId: string,
  filters: Omit<ProductFilters, 'hubId'> = {},
): Promise<{ items: ProductListItem[]; total: number }> {
  const conditions = [eq(products.hubId, hubId)];

  if (filters.search) {
    conditions.push(ilike(products.name, `%${escapeLike(filters.search)}%`));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category as typeof products.category.enumValues[number]));
  }
  if (filters.status) {
    conditions.push(eq(products.status, filters.status));
  }

  const where = and(...conditions);
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(limit)
      .offset(offset),
    // COUNT(*) only on the first page; deep load-more pages skip it (`-1` = "not computed").
    offset === 0 ? countRows(db, products, where) : Promise.resolve(-1),
  ]);

  const items: ProductListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    purchaseUrl: p.purchaseUrl,
    status: p.status,
    hubId: p.hubId,
    createdAt: p.createdAt,
  }));

  return { items, total };
}

export async function searchProducts(
  db: DB,
  filters: ProductFilters = {},
  requesterId?: string,
  opts?: { asPlatformAdmin?: boolean },
): Promise<{ items: ProductListItem[]; total: number }> {
  const conditions = [];

  if (filters.search) {
    conditions.push(ilike(products.name, `%${escapeLike(filters.search)}%`));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category as typeof products.category.enumValues[number]));
  }
  if (filters.status) {
    conditions.push(eq(products.status, filters.status));
  }
  if (filters.hubId) {
    conditions.push(eq(products.hubId, filters.hubId));
  }

  // Exclude PRIVATE-hub products from the public product directory/search (P-1b): a
  // `?hubId=<private hub>` query would otherwise enumerate that hub's whole catalog,
  // and the bare endpoint intermixed private-hub products (each row discloses its
  // hubId). We compute the blocked private-hub ids (minus the ones the requester is
  // an active member of) and NOT-IN filter — keeping the query products-only so the
  // join-less countRows stays valid. A platform admin sees everything.
  if (!opts?.asPlatformAdmin) {
    const privateHubs = await db
      .select({ id: hubs.id })
      .from(hubs)
      .where(eq(hubs.privacy, 'private'));
    let blocked = privateHubs.map((h) => h.id);
    if (blocked.length > 0 && requesterId) {
      const memberOf = await db
        .select({ hubId: hubMembers.hubId })
        .from(hubMembers)
        .where(and(eq(hubMembers.userId, requesterId), eq(hubMembers.status, 'active')));
      const memberSet = new Set(memberOf.map((m) => m.hubId));
      blocked = blocked.filter((id) => !memberSet.has(id));
    }
    if (blocked.length > 0) {
      conditions.push(notInArray(products.hubId, blocked));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(limit)
      .offset(offset),
    // COUNT(*) only on the first page; deep load-more pages skip it (`-1` = "not computed").
    offset === 0 ? countRows(db, products, where) : Promise.resolve(-1),
  ]);

  const items: ProductListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    purchaseUrl: p.purchaseUrl,
    status: p.status,
    hubId: p.hubId,
    createdAt: p.createdAt,
  }));

  return { items, total };
}

// --- Content-Product Linking (BOM) ---

export async function addContentProduct(
  db: DB,
  contentId: string,
  input: {
    productId: string;
    quantity?: number;
    role?: string;
    notes?: string;
    required?: boolean;
    sortOrder?: number;
  },
): Promise<ContentProductItem | null> {
  const product = await db
    .select({ id: products.id, name: products.name, slug: products.slug, imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  if (product.length === 0) return null;

  const [row] = await db
    .insert(contentProducts)
    .values({
      contentId,
      productId: input.productId,
      quantity: input.quantity ?? 1,
      role: input.role ?? null,
      notes: input.notes ?? null,
      required: input.required ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .onConflictDoNothing()
    .returning();

  if (!row) return null;

  return {
    id: row.id,
    productId: product[0]!.id,
    productName: product[0]!.name,
    productSlug: product[0]!.slug,
    productImageUrl: product[0]!.imageUrl,
    quantity: row.quantity,
    role: row.role,
    notes: row.notes,
    required: row.required,
    sortOrder: row.sortOrder,
  };
}

export async function removeContentProduct(
  db: DB,
  contentId: string,
  productId: string,
): Promise<boolean> {
  const result = await db
    .delete(contentProducts)
    .where(and(eq(contentProducts.contentId, contentId), eq(contentProducts.productId, productId)))
    .returning({ id: contentProducts.id });
  return result.length > 0;
}

export async function listContentProducts(
  db: DB,
  contentId: string,
): Promise<ContentProductItem[]> {
  const rows = await db
    .select({
      cp: contentProducts,
      product: {
        id: products.id,
        name: products.name,
        slug: products.slug,
        imageUrl: products.imageUrl,
      },
    })
    .from(contentProducts)
    .innerJoin(products, eq(contentProducts.productId, products.id))
    .where(eq(contentProducts.contentId, contentId))
    .orderBy(contentProducts.sortOrder);

  return rows.map((row) => ({
    id: row.cp.id,
    productId: row.product.id,
    productName: row.product.name,
    productSlug: row.product.slug,
    productImageUrl: row.product.imageUrl,
    quantity: row.cp.quantity,
    role: row.cp.role,
    notes: row.cp.notes,
    required: row.cp.required,
    sortOrder: row.cp.sortOrder,
  }));
}

export async function syncContentProducts(
  db: DB,
  contentId: string,
  items: Array<{
    productId: string;
    quantity?: number;
    role?: string;
    notes?: string;
    required?: boolean;
  }>,
): Promise<ContentProductItem[]> {
  return db.transaction(async (tx) => {
    // Remove existing links
    await tx.delete(contentProducts).where(eq(contentProducts.contentId, contentId));

    if (items.length === 0) return [];

    // Filter to productIds that actually exist; ignore unknown ids rather than
    // blind-inserting and triggering an unhandled FK violation (mirrors
    // addContentProduct returning null on a missing product).
    const requestedIds = items.map((item) => item.productId);
    const existing = await tx
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, requestedIds));
    const validIds = new Set(existing.map((p) => p.id));

    const validItems = items.filter((item) => validIds.has(item.productId));

    if (validItems.length > 0) {
      // Insert new links
      await tx.insert(contentProducts).values(
        validItems.map((item, index) => ({
          contentId,
          productId: item.productId,
          quantity: item.quantity ?? 1,
          role: item.role ?? null,
          notes: item.notes ?? null,
          required: item.required ?? true,
          sortOrder: index,
        })),
      );
    }

    // Return the new list
    const rows = await tx
      .select({
        cp: contentProducts,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
          imageUrl: products.imageUrl,
        },
      })
      .from(contentProducts)
      .innerJoin(products, eq(contentProducts.productId, products.id))
      .where(eq(contentProducts.contentId, contentId))
      .orderBy(contentProducts.sortOrder);

    return rows.map((row) => ({
      id: row.cp.id,
      productId: row.product.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      productImageUrl: row.product.imageUrl,
      quantity: row.cp.quantity,
      role: row.cp.role,
      notes: row.cp.notes,
      required: row.cp.required,
      sortOrder: row.cp.sortOrder,
    }));
  });
}

// --- Gallery Queries ---

export async function listProductContent(
  db: DB,
  productId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: Array<{ id: string; title: string; slug: string; type: string; coverImageUrl: string | null; author: UserRef; publishedAt: Date | null }>; total: number }> {
  const { limit, offset } = normalizePagination(opts);

  // visibleContentWhere() = published + public + not-soft-deleted (no requester: a product
  // gallery is a public surface). Replaces the old status-only filter, which leaked
  // members/private and resurfaced soft-deleted-published rows (P-1 sites 9 + 19).
  const where = and(
    eq(contentProducts.productId, productId),
    visibleContentWhere(),
  );

  const [rows, countResult] = await Promise.all([
    db
      .select({
        content: {
          id: contentItems.id,
          title: contentItems.title,
          slug: contentItems.slug,
          type: contentItems.type,
          coverImageUrl: contentItems.coverImageUrl,
          publishedAt: contentItems.publishedAt,
        },
        author: USER_REF_SELECT,
      })
      .from(contentProducts)
      .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(where)
      // desc(id) tiebreaker: publishedAt is non-unique, so without it offset pages overlap.
      .orderBy(desc(contentItems.publishedAt), desc(contentItems.id))
      .limit(limit)
      .offset(offset),
    // COUNT(*) only on the first page; deep load-more pages skip it (`-1` = "not computed").
    offset === 0
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(contentProducts)
          .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
          .where(where)
      : Promise.resolve([{ count: -1 }]),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.content,
      author: row.author,
    })),
    total: countResult[0]?.count ?? 0,
  };
}

export async function listHubGallery(
  db: DB,
  hubId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: Array<{ id: string; title: string; slug: string; type: string; coverImageUrl: string | null; author: UserRef; publishedAt: Date | null }>; total: number }> {
  const { limit, offset } = normalizePagination(opts);

  // Get hub type to determine gallery source
  const hub = await db
    .select({ id: hubs.id, hubType: hubs.hubType })
    .from(hubs)
    .where(eq(hubs.id, hubId))
    .limit(1);

  if (hub.length === 0) return { items: [], total: 0 };

  const hubType = hub[0]!.hubType;

  if (hubType === 'product') {
    // Product hub: gallery from contentProducts where product.hubId = this hub
    const productIds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.hubId, hubId));

    if (productIds.length === 0) return { items: [], total: 0 };

    const pIds = productIds.map((p) => p.id);
    const where = and(
      inArray(contentProducts.productId, pIds),
      visibleContentWhere(),
    );

    const [rows, countResult] = await Promise.all([
      db
        .selectDistinctOn([contentItems.id], {
          content: {
            id: contentItems.id,
            title: contentItems.title,
            slug: contentItems.slug,
            type: contentItems.type,
            coverImageUrl: contentItems.coverImageUrl,
            publishedAt: contentItems.publishedAt,
          },
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(contentProducts)
        .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
        .innerJoin(users, eq(contentItems.authorId, users.id))
        .where(where)
        .orderBy(contentItems.id, desc(contentItems.publishedAt))
        .limit(limit)
        .offset(offset),
      // COUNT only on the first page; deep load-more pages skip it (`-1` = "not computed").
      offset === 0
        ? db
            .select({ count: sql<number>`count(DISTINCT ${contentItems.id})::int` })
            .from(contentProducts)
            .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
            .where(where)
        : Promise.resolve([{ count: -1 }]),
    ]);

    return {
      items: rows.map((row) => ({ ...row.content, author: row.author })),
      total: countResult[0]?.count ?? 0,
    };
  }

  if (hubType === 'company') {
    // Company hub: gallery from contentProducts where product belongs to any child hub
    const childHubIds = await db
      .select({ id: hubs.id })
      .from(hubs)
      .where(eq(hubs.parentHubId, hubId));

    const allHubIds = [hubId, ...childHubIds.map((h) => h.id)];

    const productIds = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.hubId, allHubIds));

    if (productIds.length === 0) return { items: [], total: 0 };

    const pIds = productIds.map((p) => p.id);
    const where = and(
      inArray(contentProducts.productId, pIds),
      visibleContentWhere(),
    );

    const [rows, countResult] = await Promise.all([
      db
        .selectDistinctOn([contentItems.id], {
          content: {
            id: contentItems.id,
            title: contentItems.title,
            slug: contentItems.slug,
            type: contentItems.type,
            coverImageUrl: contentItems.coverImageUrl,
            publishedAt: contentItems.publishedAt,
          },
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(contentProducts)
        .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
        .innerJoin(users, eq(contentItems.authorId, users.id))
        .where(where)
        .orderBy(contentItems.id, desc(contentItems.publishedAt))
        .limit(limit)
        .offset(offset),
      // COUNT only on the first page; deep load-more pages skip it (`-1` = "not computed").
      offset === 0
        ? db
            .select({ count: sql<number>`count(DISTINCT ${contentItems.id})::int` })
            .from(contentProducts)
            .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
            .where(where)
        : Promise.resolve([{ count: -1 }]),
    ]);

    return {
      items: rows.map((row) => ({ ...row.content, author: row.author })),
      total: countResult[0]?.count ?? 0,
    };
  }

  // Community hub: gallery from hubShares
  const { hubShares } = await import('@commonpub/schema');

  const where = and(
    eq(hubShares.hubId, hubId),
    visibleContentWhere(),
  );

  const [rows, countResult] = await Promise.all([
    db
      .select({
        content: {
          id: contentItems.id,
          title: contentItems.title,
          slug: contentItems.slug,
          type: contentItems.type,
          coverImageUrl: contentItems.coverImageUrl,
          publishedAt: contentItems.publishedAt,
        },
        author: USER_REF_SELECT,
      })
      .from(hubShares)
      .innerJoin(contentItems, eq(hubShares.contentId, contentItems.id))
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(where)
      // desc(id) tiebreaker: createdAt is non-unique, so without it offset pages overlap.
      .orderBy(desc(hubShares.createdAt), desc(hubShares.id))
      .limit(limit)
      .offset(offset),
    // COUNT(*) only on the first page; deep load-more pages skip it (`-1` = "not computed").
    offset === 0
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(hubShares)
          .innerJoin(contentItems, eq(hubShares.contentId, contentItems.id))
          .where(where)
      : Promise.resolve([{ count: -1 }]),
  ]);

  return {
    items: rows.map((row) => ({ ...row.content, author: row.author })),
    total: countResult[0]?.count ?? 0,
  };
}
