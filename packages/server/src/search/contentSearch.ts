/**
 * Content search service — Meilisearch with Postgres FTS fallback.
 *
 * When a Meilisearch client is provided, searches are fast and ranked by relevance.
 * When not available, falls back to Postgres full-text search (to_tsvector/websearch_to_tsquery).
 * Both paths search title, description, AND content body.
 */
import { eq, and, desc, sql, isNull, ilike, or, gte, lte } from 'drizzle-orm';
import { contentItems, users, tags, contentTags } from '@commonpub/schema';
import type { DB } from '../types.js';

export interface ContentSearchResult {
  id: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  difficulty: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  tags: string[];
  /** Meilisearch only: highlighted snippet */
  snippet?: string;
}

export interface ContentSearchOptions {
  query: string;
  type?: string;
  difficulty?: string;
  tags?: string[];
  authorUsername?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'relevance' | 'recent' | 'popular';
  limit?: number;
  offset?: number;
}

export interface MeiliClient {
  index(uid: string): {
    search(query: string, options?: Record<string, unknown>): Promise<{
      hits: Array<Record<string, unknown>>;
      estimatedTotalHits?: number;
      totalHits?: number;
    }>;
    addDocuments(documents: Array<Record<string, unknown>>, options?: { primaryKey?: string }): Promise<unknown>;
    updateDocuments(documents: Array<Record<string, unknown>>, options?: { primaryKey?: string }): Promise<unknown>;
    deleteDocuments(ids: string[]): Promise<unknown>;
    updateFilterableAttributes(attributes: string[]): Promise<unknown>;
    updateSearchableAttributes(attributes: string[]): Promise<unknown>;
    updateSortableAttributes(attributes: string[]): Promise<unknown>;
  };
}

const INDEX_NAME = 'content';

// --- Meilisearch Search ---

export async function searchWithMeilisearch(
  client: MeiliClient,
  db: DB,
  opts: ContentSearchOptions,
): Promise<{ items: ContentSearchResult[]; total: number }> {
  const limit = Math.min(opts.limit ?? 24, 100);
  const offset = opts.offset ?? 0;

  const filter: string[] = ['status = "published"'];
  if (opts.type) filter.push(`type = "${opts.type}"`);
  if (opts.difficulty) filter.push(`difficulty = "${opts.difficulty}"`);
  if (opts.dateFrom) filter.push(`publishedAtTs >= ${new Date(opts.dateFrom).getTime() / 1000}`);
  if (opts.dateTo) filter.push(`publishedAtTs <= ${new Date(opts.dateTo).getTime() / 1000}`);
  if (opts.authorUsername) filter.push(`authorUsername = "${opts.authorUsername}"`);
  if (opts.tags?.length) {
    filter.push(opts.tags.map(t => `tags = "${t}"`).join(' OR '));
  }

  const sortOpts: string[] = [];
  if (opts.sort === 'recent') sortOpts.push('publishedAtTs:desc');
  else if (opts.sort === 'popular') sortOpts.push('viewCount:desc');
  // 'relevance' is default — Meilisearch handles it

  const index = client.index(INDEX_NAME);
  const response = await index.search(opts.query, {
    filter: filter.join(' AND '),
    sort: sortOpts.length ? sortOpts : undefined,
    limit,
    offset,
    attributesToHighlight: ['title', 'description', 'contentText'],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>',
  });

  const items: ContentSearchResult[] = response.hits.map((hit) => ({
    id: hit.id as string,
    type: hit.type as string,
    title: hit.title as string,
    slug: hit.slug as string,
    description: hit.description as string | null,
    coverImageUrl: hit.coverImageUrl as string | null,
    authorId: hit.authorId as string,
    authorUsername: hit.authorUsername as string,
    authorDisplayName: hit.authorDisplayName as string | null,
    authorAvatarUrl: hit.authorAvatarUrl as string | null,
    difficulty: hit.difficulty as string | null,
    viewCount: hit.viewCount as number,
    likeCount: hit.likeCount as number,
    commentCount: hit.commentCount as number,
    publishedAt: hit.publishedAt ? new Date(hit.publishedAt as string) : null,
    tags: (hit.tags as string[]) ?? [],
    snippet: ((hit._formatted as Record<string, unknown>)?.description ?? (hit._formatted as Record<string, unknown>)?.contentText ?? '') as string,
  }));

  return {
    items,
    total: response.totalHits ?? response.estimatedTotalHits ?? items.length,
  };
}

// --- Postgres FTS Search ---

export async function searchWithPostgres(
  db: DB,
  opts: ContentSearchOptions,
): Promise<{ items: ContentSearchResult[]; total: number }> {
  const limit = Math.min(opts.limit ?? 24, 100);
  const offset = opts.offset ?? 0;

  const conditions = [
    eq(contentItems.status, 'published'),
    isNull(contentItems.deletedAt),
  ];

  const validContentTypes = new Set(['project', 'article', 'blog', 'explainer']);
  if (opts.type && validContentTypes.has(opts.type)) {
    conditions.push(eq(contentItems.type, opts.type as 'project' | 'article' | 'blog' | 'explainer'));
  }
  if (opts.difficulty) conditions.push(eq(contentItems.difficulty, opts.difficulty as 'beginner' | 'intermediate' | 'advanced'));
  if (opts.dateFrom) conditions.push(gte(contentItems.publishedAt, new Date(opts.dateFrom)));
  if (opts.dateTo) conditions.push(lte(contentItems.publishedAt, new Date(opts.dateTo)));

  // Author filter by username
  if (opts.authorUsername) {
    const [author] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, opts.authorUsername))
      .limit(1);
    if (author) {
      conditions.push(eq(contentItems.authorId, author.id));
    } else {
      return { items: [], total: 0 }; // Unknown author
    }
  }

  // Text search on title + description.
  // contentItems.content is JSONB (block tuples), not directly searchable text.
  // Meilisearch path extracts text from blocks; Postgres path uses title + description.
  const query = opts.query.trim();
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      or(
        ilike(contentItems.title, pattern),
        ilike(contentItems.description, pattern),
      )!,
    );
  }

  // Tag filter
  if (opts.tags?.length) {
    const tagRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(or(...opts.tags.map(t => eq(tags.slug, t.toLowerCase().replace(/\s+/g, '-')))));
    if (tagRows.length > 0) {
      const tagIds = tagRows.map(t => t.id);
      conditions.push(
        sql`${contentItems.id} IN (SELECT content_id FROM content_tags WHERE tag_id = ANY(ARRAY[${sql.join(tagIds.map(id => sql`${id}::uuid`), sql`, `)}]))`,
      );
    }
  }

  const where = and(...conditions);

  // Sort — Postgres fallback doesn't have relevance ranking (that's what Meilisearch is for)
  let orderBy;
  if (opts.sort === 'popular') {
    orderBy = desc(contentItems.viewCount);
  } else {
    // 'relevance' and 'recent' both use publishedAt for Postgres path
    orderBy = desc(contentItems.publishedAt);
  }

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: contentItems.id,
        type: contentItems.type,
        title: contentItems.title,
        slug: contentItems.slug,
        description: contentItems.description,
        coverImageUrl: contentItems.coverImageUrl,
        difficulty: contentItems.difficulty,
        viewCount: contentItems.viewCount,
        likeCount: contentItems.likeCount,
        commentCount: contentItems.commentCount,
        publishedAt: contentItems.publishedAt,
        authorId: contentItems.authorId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(contentItems)
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentItems)
      .where(where),
  ]);

  const items: ContentSearchResult[] = rows.map((r) => ({
    ...r,
    tags: [],
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

// --- Unified Search Function ---

/**
 * Search content using Meilisearch if available, Postgres FTS otherwise.
 */
export async function searchContent(
  db: DB,
  opts: ContentSearchOptions,
  meiliClient?: MeiliClient | null,
): Promise<{ items: ContentSearchResult[]; total: number }> {
  if (meiliClient) {
    try {
      return await searchWithMeilisearch(meiliClient, db, opts);
    } catch (err) {
      console.warn('[search] Meilisearch failed, falling back to Postgres:', err instanceof Error ? err.message : err);
    }
  }
  return searchWithPostgres(db, opts);
}

// --- Meilisearch Indexing ---

/**
 * Index a content item into Meilisearch. Call on publish/update.
 */
export async function indexContent(
  db: DB,
  contentId: string,
  meiliClient: MeiliClient,
): Promise<void> {
  const [row] = await db
    .select({
      id: contentItems.id,
      type: contentItems.type,
      title: contentItems.title,
      slug: contentItems.slug,
      description: contentItems.description,
      content: contentItems.content,
      coverImageUrl: contentItems.coverImageUrl,
      difficulty: contentItems.difficulty,
      status: contentItems.status,
      viewCount: contentItems.viewCount,
      likeCount: contentItems.likeCount,
      commentCount: contentItems.commentCount,
      publishedAt: contentItems.publishedAt,
      authorId: contentItems.authorId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (!row || row.status !== 'published') {
    // Not published — remove from index if it was there
    try {
      await meiliClient.index(INDEX_NAME).deleteDocuments([contentId]);
    } catch { /* best effort */ }
    return;
  }

  // Strip content to plain text for indexing
  let contentText = '';
  if (row.content) {
    const raw = typeof row.content === 'string' ? row.content : JSON.stringify(row.content);
    contentText = raw
      .replace(/<[^>]*>/g, ' ')    // strip HTML
      .replace(/\[|\]|{|}|"/g, ' ') // strip JSON brackets/quotes
      .replace(/\s+/g, ' ')         // collapse whitespace
      .trim()
      .slice(0, 50000);             // limit index size
  }

  // Get tags
  const contentTagRows = await db
    .select({ name: tags.name })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, contentId));

  const index = meiliClient.index(INDEX_NAME);
  await index.addDocuments([{
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    description: row.description ?? '',
    contentText,
    coverImageUrl: row.coverImageUrl,
    difficulty: row.difficulty,
    status: row.status,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedAtTs: row.publishedAt ? Math.floor(row.publishedAt.getTime() / 1000) : 0,
    authorId: row.authorId,
    authorUsername: row.authorUsername,
    authorDisplayName: row.authorDisplayName,
    authorAvatarUrl: row.authorAvatarUrl,
    tags: contentTagRows.map(t => t.name),
  }], { primaryKey: 'id' });
}

/**
 * Remove a content item from the Meilisearch index. Call on delete/unpublish.
 */
export async function removeFromIndex(
  contentId: string,
  meiliClient: MeiliClient,
): Promise<void> {
  await meiliClient.index(INDEX_NAME).deleteDocuments([contentId]);
}

/**
 * Configure the Meilisearch content index. Call once at startup.
 */
export async function configureContentIndex(
  meiliClient: MeiliClient,
): Promise<void> {
  const index = meiliClient.index(INDEX_NAME);
  await index.updateSearchableAttributes(['title', 'description', 'contentText', 'tags']);
  await index.updateFilterableAttributes(['type', 'difficulty', 'status', 'authorUsername', 'publishedAtTs', 'tags']);
  await index.updateSortableAttributes(['publishedAtTs', 'viewCount', 'likeCount']);
}
