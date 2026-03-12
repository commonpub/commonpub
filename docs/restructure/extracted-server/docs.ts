import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { docsSites, docsVersions, docsPages, docsNav, users } from '@commonpub/schema';
import { buildPagePath } from '@commonpub/docs';
import type { DocsPage } from '@commonpub/docs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { generateSlug } from '../utils/slug';

type DB = NodePgDatabase<Record<string, unknown>>;

// --- Site CRUD ---

export async function listDocsSites(
  db: DB,
  filters: { ownerId?: string; limit?: number; offset?: number } = {},
): Promise<{
  items: Array<
    typeof docsSites.$inferSelect & {
      owner: { id: string; username: string; displayName: string | null };
    }
  >;
  total: number;
}> {
  const conditions = [];
  if (filters.ownerId) {
    conditions.push(eq(docsSites.ownerId, filters.ownerId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        site: docsSites,
        owner: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(docsSites)
      .innerJoin(users, eq(docsSites.ownerId, users.id))
      .where(where)
      .orderBy(desc(docsSites.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(docsSites)
      .where(where),
  ]);

  const items = rows.map((row) => ({
    ...row.site,
    owner: row.owner,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getDocsSiteBySlug(
  db: DB,
  slug: string,
): Promise<{
  site: typeof docsSites.$inferSelect & {
    owner: { id: string; username: string; displayName: string | null };
  };
  versions: Array<typeof docsVersions.$inferSelect>;
} | null> {
  const rows = await db
    .select({
      site: docsSites,
      owner: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(docsSites)
    .innerJoin(users, eq(docsSites.ownerId, users.id))
    .where(eq(docsSites.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  const versions = await db
    .select()
    .from(docsVersions)
    .where(eq(docsVersions.siteId, row.site.id))
    .orderBy(desc(docsVersions.createdAt));

  return {
    site: { ...row.site, owner: row.owner },
    versions,
  };
}

export async function createDocsSite(
  db: DB,
  ownerId: string,
  input: { name: string; slug?: string; description?: string },
): Promise<typeof docsSites.$inferSelect> {
  const slug = await ensureUniqueDocsSiteSlug(db, input.slug || generateSlug(input.name));

  const [site] = await db
    .insert(docsSites)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      ownerId,
    })
    .returning();

  // Create initial "v1" version
  await db.insert(docsVersions).values({
    siteId: site!.id,
    version: 'v1',
    isDefault: 1,
  });

  return site!;
}

export async function updateDocsSite(
  db: DB,
  siteId: string,
  ownerId: string,
  input: { name?: string; description?: string },
): Promise<typeof docsSites.$inferSelect | null> {
  const existing = await db
    .select()
    .from(docsSites)
    .where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (existing.length === 0) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    updates.name = input.name;
    if (input.name !== existing[0]!.name) {
      updates.slug = await ensureUniqueDocsSiteSlug(db, generateSlug(input.name), siteId);
    }
  }
  if (input.description !== undefined) updates.description = input.description;

  const [updated] = await db
    .update(docsSites)
    .set(updates)
    .where(eq(docsSites.id, siteId))
    .returning();

  return updated!;
}

export async function deleteDocsSite(db: DB, siteId: string, ownerId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(docsSites)
    .where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (existing.length === 0) return false;

  await db.delete(docsSites).where(eq(docsSites.id, siteId));
  return true;
}

// --- Version CRUD ---

export async function createDocsVersion(
  db: DB,
  siteId: string,
  ownerId: string,
  input: { version: string; sourceVersionId?: string; isDefault?: boolean },
): Promise<typeof docsVersions.$inferSelect> {
  // Ownership check
  const site = await db
    .select()
    .from(docsSites)
    .where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (site.length === 0) throw new Error('Not authorized');

  const [version] = await db
    .insert(docsVersions)
    .values({
      siteId,
      version: input.version,
      isDefault: input.isDefault ? 1 : 0,
    })
    .returning();

  // Copy pages from source version if provided
  if (input.sourceVersionId) {
    const sourcePages = await db
      .select()
      .from(docsPages)
      .where(eq(docsPages.versionId, input.sourceVersionId))
      .orderBy(asc(docsPages.sortOrder));

    if (sourcePages.length > 0) {
      // Map old IDs to new IDs for parentId remapping
      const oldToNew = new Map<string, string>();
      const pagesToInsert = sourcePages.map((page) => {
        const newId = crypto.randomUUID();
        oldToNew.set(page.id, newId);
        return {
          id: newId,
          versionId: version!.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          sortOrder: page.sortOrder,
          parentId: null as string | null,
        };
      });

      // Remap parentIds
      for (let i = 0; i < sourcePages.length; i++) {
        const oldParent = sourcePages[i]!.parentId;
        if (oldParent) {
          pagesToInsert[i]!.parentId = oldToNew.get(oldParent) ?? null;
        }
      }

      await db.insert(docsPages).values(pagesToInsert);
    }
  }

  // Toggle isDefault if needed
  if (input.isDefault) {
    await db
      .update(docsVersions)
      .set({ isDefault: 0 })
      .where(and(eq(docsVersions.siteId, siteId), sql`${docsVersions.id} != ${version!.id}`));
  }

  return version!;
}

export async function setDefaultVersion(
  db: DB,
  versionId: string,
  ownerId: string,
): Promise<boolean> {
  const version = await db
    .select({ version: docsVersions, site: docsSites })
    .from(docsVersions)
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsVersions.id, versionId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (version.length === 0) return false;

  const siteId = version[0]!.site.id;

  // Atomically unset all then set one
  await db.transaction(async (tx) => {
    await tx.update(docsVersions).set({ isDefault: 0 }).where(eq(docsVersions.siteId, siteId));
    await tx.update(docsVersions).set({ isDefault: 1 }).where(eq(docsVersions.id, versionId));
  });

  return true;
}

export async function deleteDocsVersion(
  db: DB,
  versionId: string,
  ownerId: string,
): Promise<boolean> {
  const version = await db
    .select({ version: docsVersions, site: docsSites })
    .from(docsVersions)
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsVersions.id, versionId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (version.length === 0) return false;

  await db.delete(docsVersions).where(eq(docsVersions.id, versionId));
  return true;
}

// --- Page CRUD ---

export async function listDocsPages(
  db: DB,
  versionId: string,
): Promise<Array<typeof docsPages.$inferSelect>> {
  return db
    .select()
    .from(docsPages)
    .where(eq(docsPages.versionId, versionId))
    .orderBy(asc(docsPages.sortOrder));
}

export async function getDocsPage(
  db: DB,
  versionId: string,
  pagePath: string,
): Promise<typeof docsPages.$inferSelect | null> {
  // Get all pages for this version to resolve path
  const allPages = await listDocsPages(db, versionId);

  // Find page matching the slug path
  const pagesAsDocsPage: DocsPage[] = allPages.map((p) => ({
    id: p.id,
    versionId: p.versionId,
    title: p.title,
    slug: p.slug,
    content: p.content,
    sortOrder: p.sortOrder,
    parentId: p.parentId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  for (const page of pagesAsDocsPage) {
    const path = buildPagePath(pagesAsDocsPage, page.id);
    if (path === pagePath) {
      return allPages.find((p) => p.id === page.id) ?? null;
    }
  }

  return null;
}

export async function createDocsPage(
  db: DB,
  ownerId: string,
  input: {
    versionId: string;
    title: string;
    slug?: string;
    content: string;
    sortOrder?: number;
    parentId?: string;
  },
): Promise<typeof docsPages.$inferSelect> {
  // Verify ownership via version → site
  const version = await db
    .select({ version: docsVersions, site: docsSites })
    .from(docsVersions)
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsVersions.id, input.versionId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (version.length === 0) throw new Error('Not authorized');

  // Auto sort order
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const conditions = [eq(docsPages.versionId, input.versionId)];
    if (input.parentId) {
      conditions.push(eq(docsPages.parentId, input.parentId));
    }
    const maxSort = await db
      .select({ max: sql<number>`coalesce(max(${docsPages.sortOrder}), -1)` })
      .from(docsPages)
      .where(and(...conditions));
    sortOrder = (maxSort[0]?.max ?? -1) + 1;
  }

  const slug = input.slug || generateSlug(input.title);

  const [page] = await db
    .insert(docsPages)
    .values({
      versionId: input.versionId,
      title: input.title,
      slug,
      content: input.content,
      sortOrder,
      parentId: input.parentId ?? null,
    })
    .returning();

  return page!;
}

export async function updateDocsPage(
  db: DB,
  pageId: string,
  ownerId: string,
  input: {
    title?: string;
    slug?: string;
    content?: string;
    sortOrder?: number;
    parentId?: string | null;
  },
): Promise<typeof docsPages.$inferSelect | null> {
  // Verify ownership via page → version → site
  const page = await db
    .select({ page: docsPages, version: docsVersions, site: docsSites })
    .from(docsPages)
    .innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id))
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsPages.id, pageId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (page.length === 0) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.content !== undefined) updates.content = input.content;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.parentId !== undefined) updates.parentId = input.parentId;

  const [updated] = await db
    .update(docsPages)
    .set(updates)
    .where(eq(docsPages.id, pageId))
    .returning();

  return updated!;
}

export async function deleteDocsPage(db: DB, pageId: string, ownerId: string): Promise<boolean> {
  const page = await db
    .select({ page: docsPages, version: docsVersions, site: docsSites })
    .from(docsPages)
    .innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id))
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsPages.id, pageId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (page.length === 0) return false;

  await db.delete(docsPages).where(eq(docsPages.id, pageId));
  return true;
}

export async function reorderDocsPages(
  db: DB,
  versionId: string,
  ownerId: string,
  pageIds: string[],
): Promise<boolean> {
  // Verify ownership via version → site
  const version = await db
    .select({ version: docsVersions, site: docsSites })
    .from(docsVersions)
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsVersions.id, versionId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (version.length === 0) return false;

  await db.transaction(async (tx) => {
    for (let i = 0; i < pageIds.length; i++) {
      await tx
        .update(docsPages)
        .set({ sortOrder: i })
        .where(and(eq(docsPages.id, pageIds[i]!), eq(docsPages.versionId, versionId)));
    }
  });

  return true;
}

// --- Nav ---

export async function getDocsNav(
  db: DB,
  versionId: string,
): Promise<typeof docsNav.$inferSelect | null> {
  const rows = await db.select().from(docsNav).where(eq(docsNav.versionId, versionId)).limit(1);

  return rows[0] ?? null;
}

export async function updateDocsNav(
  db: DB,
  versionId: string,
  ownerId: string,
  structure: unknown,
): Promise<typeof docsNav.$inferSelect> {
  // Verify ownership via version → site
  const version = await db
    .select({ version: docsVersions, site: docsSites })
    .from(docsVersions)
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsVersions.id, versionId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (version.length === 0) throw new Error('Not authorized');

  // Upsert
  const existing = await db.select().from(docsNav).where(eq(docsNav.versionId, versionId)).limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(docsNav)
      .set({ structure: structure as typeof docsNav.$inferInsert.structure, updatedAt: new Date() })
      .where(eq(docsNav.id, existing[0]!.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(docsNav)
    .values({
      versionId,
      structure: structure as typeof docsNav.$inferInsert.structure,
    })
    .returning();

  return created!;
}

// --- Search ---

export async function searchDocsPages(
  db: DB,
  siteId: string,
  versionId: string,
  query: string,
): Promise<Array<{ id: string; title: string; slug: string; snippet: string }>> {
  if (!query.trim()) return [];

  const tsQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .map((t) => `${t}:*`)
    .join(' & ');

  if (!tsQuery) return [];

  const results = await db
    .select({
      id: docsPages.id,
      title: docsPages.title,
      slug: docsPages.slug,
      snippet: sql<string>`ts_headline('english', ${docsPages.content}, to_tsquery('english', ${tsQuery}), 'MaxWords=30, MinWords=15')`,
    })
    .from(docsPages)
    .innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id))
    .where(
      and(
        eq(docsPages.versionId, versionId),
        eq(docsVersions.siteId, siteId),
        sql`to_tsvector('english', ${docsPages.title} || ' ' || ${docsPages.content}) @@ to_tsquery('english', ${tsQuery})`,
      ),
    )
    .limit(20);

  return results;
}

// --- Helpers ---

async function ensureUniqueDocsSiteSlug(db: DB, slug: string, excludeId?: string): Promise<string> {
  if (!slug) slug = `docs-${Date.now()}`;

  const conditions = [eq(docsSites.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(docsSites.id, excludeId));
  }

  const existing = await db
    .select({ id: docsSites.id })
    .from(docsSites)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) return slug;
  return `${slug}-${Date.now()}`;
}
