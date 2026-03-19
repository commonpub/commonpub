import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import {
  products,
  contentProducts,
  contentItems,
  hubs,
  users,
} from '@commonpub/schema';
import type { DB, UserRef } from './types.js';
import { generateSlug } from './utils.js';

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

// --- Slug Helper ---

async function ensureUniqueProductSlug(
  db: DB,
  slug: string,
  excludeId?: string,
): Promise<string> {
  if (!slug) slug = `product-${Date.now()}`;

  const conditions = [eq(products.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(products.id, excludeId));
  }

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) return slug;
  return `${slug}-${Date.now()}`;
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
  const slug = await ensureUniqueProductSlug(db, generateSlug(input.name));

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

  return (await getProductBySlug(db, product!.slug))!;
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

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = await ensureUniqueProductSlug(db, generateSlug(input.name), productId);
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

  return getProductBySlug(db, updated[0]!.slug);
}

export async function deleteProduct(
  db: DB,
  productId: string,
): Promise<boolean> {
  const result = await db.delete(products).where(eq(products.id, productId)).returning({ id: products.id });
  return result.length > 0;
}

export async function getProductBySlug(
  db: DB,
  slug: string,
): Promise<ProductDetail | null> {
  const rows = await db
    .select({
      product: products,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      hub: {
        id: hubs.id,
        name: hubs.name,
        slug: hubs.slug,
        hubType: hubs.hubType,
      },
    })
    .from(products)
    .innerJoin(users, eq(products.createdById, users.id))
    .innerJoin(hubs, eq(products.hubId, hubs.id))
    .where(eq(products.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
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
    conditions.push(ilike(products.name, `%${filters.search}%`));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category as typeof products.category.enumValues[number]));
  }
  if (filters.status) {
    conditions.push(eq(products.status, filters.status));
  }

  const where = and(...conditions);
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
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

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function searchProducts(
  db: DB,
  filters: ProductFilters = {},
): Promise<{ items: ProductListItem[]; total: number }> {
  const conditions = [];

  if (filters.search) {
    conditions.push(ilike(products.name, `%${filters.search}%`));
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

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
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

  return { items, total: countResult[0]?.count ?? 0 };
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

    // Insert new links
    await tx.insert(contentProducts).values(
      items.map((item, index) => ({
        contentId,
        productId: item.productId,
        quantity: item.quantity ?? 1,
        role: item.role ?? null,
        notes: item.notes ?? null,
        required: item.required ?? true,
        sortOrder: index,
      })),
    );

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
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const where = and(
    eq(contentProducts.productId, productId),
    eq(contentItems.status, 'published'),
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
      .orderBy(desc(contentItems.publishedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentProducts)
      .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
      .where(where),
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
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

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
      eq(contentItems.status, 'published'),
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
      db
        .select({ count: sql<number>`count(DISTINCT ${contentItems.id})::int` })
        .from(contentProducts)
        .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
        .where(where),
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
      eq(contentItems.status, 'published'),
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
      db
        .select({ count: sql<number>`count(DISTINCT ${contentItems.id})::int` })
        .from(contentProducts)
        .innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id))
        .where(where),
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
    eq(contentItems.status, 'published'),
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
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(hubShares)
      .innerJoin(contentItems, eq(hubShares.contentId, contentItems.id))
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(where)
      .orderBy(desc(hubShares.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(hubShares)
      .innerJoin(contentItems, eq(hubShares.contentId, contentItems.id))
      .where(where),
  ]);

  return {
    items: rows.map((row) => ({ ...row.content, author: row.author })),
    total: countResult[0]?.count ?? 0,
  };
}
