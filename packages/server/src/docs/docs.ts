import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { docsSites, docsVersions, docsPages, users } from '@commonpub/schema';
import { buildPagePath } from '@commonpub/docs';
import type { DocsPage } from '@commonpub/docs';
import type { DB } from '../types.js';
import { generateSlug } from '../utils.js';
import { ensureUniqueSlugFor, normalizePagination, countRows } from '../query.js';

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
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
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
    countRows(db, docsSites, where),
  ]);

  const items = rows.map((row) => ({
    ...row.site,
    owner: row.owner,
  }));

  return { items, total };
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
  const slug = await ensureUniqueSlugFor(db, docsSites, docsSites.slug, docsSites.id, input.slug || generateSlug(input.name), 'docs');

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
    isDefault: true,
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
      updates.slug = await ensureUniqueSlugFor(db, docsSites, docsSites.slug, docsSites.id, generateSlug(input.name), 'docs', siteId);
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
      isDefault: input.isDefault ?? false,
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
      .set({ isDefault: false })
      .where(
        and(eq(docsVersions.siteId, siteId), sql`${docsVersions.id} != ${version!.id}`),
      );
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

  await db.transaction(async (tx) => {
    await tx.update(docsVersions).set({ isDefault: false }).where(eq(docsVersions.siteId, siteId));
    await tx.update(docsVersions).set({ isDefault: true }).where(eq(docsVersions.id, versionId));
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
  const allPages = await listDocsPages(db, versionId);

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
    sidebarLabel?: string;
    description?: string;
    content: string | unknown[];
    status?: string;
    sortOrder?: number;
    parentId?: string;
  },
): Promise<typeof docsPages.$inferSelect> {
  const version = await db
    .select({ version: docsVersions, site: docsSites })
    .from(docsVersions)
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsVersions.id, input.versionId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (version.length === 0) throw new Error('Not authorized');

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
      sidebarLabel: input.sidebarLabel ?? null,
      description: input.description ?? null,
      // Pass content through directly — drizzle's jsonb column serializes
      // arrays/objects correctly. Manually `JSON.stringify`-ing here would
      // double-encode (drizzle then stringifies the string), storing the
      // content as a jsonb STRING rather than a jsonb ARRAY, which breaks
      // any SQL that uses jsonb_typeof / jsonb_array_elements. Drizzle's
      // mapFromDriverValue happens to unwrap this at read time, so the app
      // works — but SQL doesn't.
      content: input.content,
      status: (input.status ?? 'draft') as typeof docsPages.status.enumValues[number],
      sortOrder,
      parentId: input.parentId ?? null,
    } satisfies typeof docsPages.$inferInsert)
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
    sidebarLabel?: string | null;
    description?: string | null;
    content?: string | unknown[];
    status?: string;
    sortOrder?: number;
    parentId?: string | null;
  },
): Promise<typeof docsPages.$inferSelect | null> {
  const page = await db
    .select({ page: docsPages, version: docsVersions, site: docsSites })
    .from(docsPages)
    .innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id))
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsPages.id, pageId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (page.length === 0) return null;

  // Prevent circular parent reference
  if (input.parentId !== undefined && input.parentId === pageId) {
    throw new Error('A page cannot be its own parent');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.sidebarLabel !== undefined) updates.sidebarLabel = input.sidebarLabel;
  if (input.description !== undefined) updates.description = input.description;
  if (input.content !== undefined) {
    // See createDocsPage for why we don't JSON.stringify here.
    updates.content = input.content;
  }
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.parentId !== undefined) updates.parentId = input.parentId;
  if (input.status !== undefined) updates.status = input.status;

  const [updated] = await db
    .update(docsPages)
    .set(updates)
    .where(eq(docsPages.id, pageId))
    .returning();

  return updated!;
}

export async function duplicateDocsPage(
  db: DB,
  pageId: string,
  ownerId: string,
): Promise<typeof docsPages.$inferSelect> {
  const source = await db
    .select({ page: docsPages, version: docsVersions, site: docsSites })
    .from(docsPages)
    .innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id))
    .innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id))
    .where(and(eq(docsPages.id, pageId), eq(docsSites.ownerId, ownerId)))
    .limit(1);

  if (source.length === 0) throw new Error('Not authorized');
  const original = source[0]!.page;

  // Compute next sortOrder among siblings
  const conditions = [eq(docsPages.versionId, original.versionId)];
  if (original.parentId) conditions.push(eq(docsPages.parentId, original.parentId));
  const maxSort = await db
    .select({ max: sql<number>`coalesce(max(${docsPages.sortOrder}), -1)` })
    .from(docsPages)
    .where(and(...conditions));
  const sortOrder = (maxSort[0]?.max ?? -1) + 1;

  const copyTitle = `${original.title} (copy)`;
  const copySlug = `${original.slug}-copy`;

  const [page] = await db
    .insert(docsPages)
    .values({
      versionId: original.versionId,
      title: copyTitle,
      slug: copySlug,
      sidebarLabel: original.sidebarLabel,
      description: original.description,
      content: original.content,
      status: 'draft',
      sortOrder,
      parentId: original.parentId,
    })
    .returning();

  return page!;
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

// --- Search ---

/** Postgres FTS language names — validated to prevent SQL injection in raw queries */
const VALID_FTS_LANGUAGES = new Set([
  'simple', 'arabic', 'armenian', 'basque', 'catalan', 'danish', 'dutch',
  'english', 'finnish', 'french', 'german', 'greek', 'hindi', 'hungarian',
  'indonesian', 'irish', 'italian', 'lithuanian', 'nepali', 'norwegian',
  'portuguese', 'romanian', 'russian', 'serbian', 'spanish', 'swedish',
  'tamil', 'turkish', 'yiddish',
]);

export async function searchDocsPages(
  db: DB,
  siteId: string,
  versionId: string,
  query: string,
  language: string = 'english',
): Promise<Array<{ id: string; title: string; slug: string; snippet: string }>> {
  if (!query.trim()) return [];

  const ftsLang = VALID_FTS_LANGUAGES.has(language) ? language : 'english';

  const tsQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .map((t) => `${t}:*`)
    .join(' & ');

  if (!tsQuery) return [];

  const langLiteral = sql.raw(`'${ftsLang}'`);

  // docsPages.content is jsonb. `content::text` produces the literal JSON
  // representation, which pollutes search with keys like "paragraph",
  // "html", bracket/brace chars, and shows raw JSON in ts_headline snippets.
  //
  // Extract just the text content via a LATERAL subquery that walks the
  // BlockTuple array and concatenates html/text/code fields with HTML tags
  // stripped. Legacy string-valued content unwraps via #>>'{}'. Anything
  // else yields empty string.
  const results = await db.execute(sql`
    SELECT
      dp.id,
      dp.title,
      dp.slug,
      ts_headline(${langLiteral}, dp.title || ' ' || extracted.text_content, to_tsquery(${langLiteral}, ${tsQuery}), 'MaxWords=30, MinWords=15') AS snippet
    FROM docs_pages dp
    INNER JOIN docs_versions dv ON dp.version_id = dv.id
    LEFT JOIN LATERAL (
      SELECT coalesce(
        CASE
          -- BlockTuple array (new format — correct jsonb array)
          WHEN jsonb_typeof(dp.content) = 'array' THEN (
            SELECT coalesce(string_agg(
              regexp_replace(
                coalesce(elem->1->>'html', elem->1->>'text', elem->1->>'code', elem->1->>'title', ''),
                '<[^>]+>', ' ', 'g'
              ),
              ' '
            ), '')
            FROM jsonb_array_elements(dp.content) AS elem
          )
          -- Historical: content got double-stringified before the session-129
          -- fix, so it landed in the DB as a jsonb STRING whose value is the
          -- JSON text of a BlockTuple array. If it looks like JSON, parse it
          -- and walk the array the same way.
          WHEN jsonb_typeof(dp.content) = 'string'
            AND substr(dp.content #>> '{}', 1, 1) IN ('[', '{')
            THEN (
              SELECT coalesce(string_agg(
                regexp_replace(
                  coalesce(elem->1->>'html', elem->1->>'text', elem->1->>'code', elem->1->>'title', ''),
                  '<[^>]+>', ' ', 'g'
                ),
                ' '
              ), '')
              FROM jsonb_array_elements((dp.content #>> '{}')::jsonb) AS elem
            )
          -- Legacy markdown pages stored as plain strings
          WHEN jsonb_typeof(dp.content) = 'string' THEN dp.content #>> '{}'
          ELSE ''
        END,
        ''
      ) AS text_content
    ) extracted ON true
    WHERE dp.version_id = ${versionId}
      AND dv.site_id = ${siteId}
      AND to_tsvector(${langLiteral}, dp.title || ' ' || extracted.text_content) @@ to_tsquery(${langLiteral}, ${tsQuery})
    LIMIT 20
  `);

  // drizzle's raw execute returns rows on `.rows` (node-postgres) or directly
  // as an array depending on driver. Normalize.
  const rows = (results as unknown as { rows?: Array<Record<string, unknown>> }).rows
    ?? (results as unknown as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    slug: r.slug as string,
    snippet: (r.snippet as string) ?? '',
  }));
}

