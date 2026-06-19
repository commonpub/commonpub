import { eq, and, desc, sql, inArray, isNull, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { contentItems, contentVersions, contentForks, contentBuilds, federatedContentBuilds, tags, contentTags, users, follows, federatedContent, remoteActors, contentCategories } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import { emitHook } from '../hooks.js';
import type { ContentItemRow } from '@commonpub/schema';
import type {
  DB,
  ContentListItem,
  ContentDetail,
  ContentFilters,
  UserRef,
} from '../types.js';
import type { CreateContentInput, UpdateContentInput } from '@commonpub/schema';
import { generateSlug } from '../utils.js';
import { ensureUniqueSlugFor, USER_REF_SELECT, USER_REF_WITH_HEADLINE_SELECT, normalizePagination, countRows, escapeLike, buildContentPath, decodeCursor, asDateUuidCursor, encodeCursor, keysetWhere, type KeysetCursor } from '../query.js';
import { federateContent, federateUpdate, federateDelete } from '../federation/federation.js';
import { createNotification } from '../notification/notification.js';

/** Sanitize HTML strings within block content to prevent XSS */
async function sanitizeBlockContent(content: unknown): Promise<unknown> {
  // ExplainerDocument format: { version: 2, hero, sections[], ... }
  if (
    typeof content === 'object' &&
    content !== null &&
    !Array.isArray(content) &&
    'version' in content &&
    (content as Record<string, unknown>).version === 2 &&
    'sections' in content
  ) {
    return sanitizeExplainerDocument(content as Record<string, unknown>);
  }

  if (!Array.isArray(content)) return content;

  // Check if any block has HTML that needs sanitizing
  const blocks = content as [string, Record<string, unknown>][];
  const hasHtml = blocks.some(([, data]) => typeof data.html === 'string' && data.html);
  if (!hasHtml) return content;

  let sanitize: (html: string) => string;
  try {
    const mod = await import('isomorphic-dompurify');
    const DOMPurify = mod.default ?? mod;
    sanitize = (html: string) => DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'span', 'sub', 'sup'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });
  } catch (err) {
    // Strip all HTML tags if DOMPurify is unavailable — never pass through unsanitized
    console.error('[sanitize] DOMPurify unavailable, stripping HTML tags:', err instanceof Error ? err.message : err);
    return blocks.map(([type, data]) => {
      const cleaned = { ...data };
      if (typeof cleaned.html === 'string' && cleaned.html) {
        cleaned.html = cleaned.html.replace(/<[^>]*>/g, '');
      }
      return [type, cleaned];
    });
  }

  return blocks.map(([type, data]) => {
    const sanitized = { ...data };
    if (typeof sanitized.html === 'string' && sanitized.html) {
      sanitized.html = sanitize(sanitized.html);
    }
    return [type, sanitized];
  });
}

/** Sanitize HTML fields within an ExplainerDocument */
async function sanitizeExplainerDocument(doc: Record<string, unknown>): Promise<Record<string, unknown>> {
  let sanitize: (html: string) => string;
  try {
    const mod = await import('isomorphic-dompurify');
    const DOMPurify = mod.default ?? mod;
    sanitize = (html: string) => DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'span', 'sub', 'sup'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });
  } catch {
    sanitize = (html: string) => html.replace(/<[^>]*>/g, '');
  }

  const result = { ...doc };

  // Sanitize hero fields
  if (result.hero && typeof result.hero === 'object') {
    const hero = { ...(result.hero as Record<string, unknown>) };
    if (typeof hero.subtitle === 'string') hero.subtitle = sanitize(hero.subtitle);
    result.hero = hero;
  }

  // Sanitize section fields
  if (Array.isArray(result.sections)) {
    result.sections = (result.sections as Array<Record<string, unknown>>).map((section) => {
      const s = { ...section };
      if (typeof s.body === 'string') s.body = sanitize(s.body);
      if (typeof s.bridge === 'string') s.bridge = sanitize(s.bridge);
      if (typeof s.insight === 'string') s.insight = sanitize(s.insight);
      if (s.aside && typeof s.aside === 'object') {
        const aside = { ...(s.aside as Record<string, unknown>) };
        if (typeof aside.text === 'string') aside.text = sanitize(aside.text);
        s.aside = aside;
      }
      return s;
    });
  }

  // Sanitize conclusion fields
  if (result.conclusion && typeof result.conclusion === 'object') {
    const conclusion = { ...(result.conclusion as Record<string, unknown>) };
    if (typeof conclusion.body === 'string') conclusion.body = sanitize(conclusion.body);
    result.conclusion = conclusion;
  }

  return result;
}

function mapToListItem(
  item: ContentItemRow,
  author: UserRef,
  category?: { name: string; slug: string; color: string | null; icon: string | null } | null,
): ContentListItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    description: item.description,
    coverImageUrl: item.coverImageUrl,
    status: item.status,
    difficulty: item.difficulty,
    viewCount: item.viewCount,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    buildCount: item.buildCount,
    isFeatured: item.isFeatured,
    isEditorial: item.isEditorial,
    editorialNote: item.editorialNote,
    categoryId: item.categoryId,
    categoryName: category?.name ?? null,
    categorySlug: category?.slug ?? null,
    categoryColor: category?.color ?? null,
    categoryIcon: category?.icon ?? null,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    author,
  };
}

/**
 * Query federated_content and map to ContentListItem shape.
 * Used by listContent when includeFederated is true.
 */
async function queryFederatedAsListItems(
  db: DB,
  filters: ContentFilters,
  maxItems = 100,
  allowedContentTypes?: string[],
  /** Keyset cursor: return only federated rows strictly after it in (publishedAt DESC NULLS LAST, id DESC). */
  cursor?: KeysetCursor | null,
): Promise<ContentListItem[]> {
  const conditions = [
    isNull(federatedContent.deletedAt),
    eq(federatedContent.isHidden, false),
  ];

  // Keyset: same total order as the merge, so each source returns its slice of the
  // global stream past the cursor. publishedAt is the lead key; id the tiebreaker.
  if (cursor) {
    conditions.push(keysetWhere(federatedContent.publishedAt, federatedContent.id, cursor));
  }

  // Filter by instance's enabled content types — prevent unsupported types from leaking into feeds
  if (allowedContentTypes && allowedContentTypes.length > 0) {
    conditions.push(
      sql`(${federatedContent.cpubType} IN (${sql.join(allowedContentTypes.map(t => sql`${t}`), sql`, `)}) OR (${federatedContent.cpubType} IS NULL AND lower(${federatedContent.apType}) IN (${sql.join(allowedContentTypes.map(t => sql`${t}`), sql`, `)})))`,
    );
  }

  // Map content type filter (federated uses cpubType or apType)
  if (filters.type) {
    conditions.push(
      sql`(${federatedContent.cpubType} = ${filters.type} OR lower(${federatedContent.apType}) = ${filters.type})`,
    );
  }

  // Search filter
  if (filters.search) {
    const searchPattern = `%${escapeLike(filters.search)}%`;
    conditions.push(
      sql`(${federatedContent.title} ILIKE ${searchPattern} OR ${federatedContent.summary} ILIKE ${searchPattern})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      fed: federatedContent,
      actor: {
        actorUri: remoteActors.actorUri,
        preferredUsername: remoteActors.preferredUsername,
        displayName: remoteActors.displayName,
        avatarUrl: remoteActors.avatarUrl,
        instanceDomain: remoteActors.instanceDomain,
      },
    })
    .from(federatedContent)
    .leftJoin(remoteActors, eq(federatedContent.remoteActorId, remoteActors.id))
    .where(where)
    // MUST match the in-app merge comparator EXACTLY (publishedAt DESC NULLS LAST,
    // id DESC) so merge(localTop-K, fedTop-K)[0:K] == globalTop-K and offset pages
    // stay disjoint. `desc()` alone is NULLS FIRST in Postgres, but the merge maps
    // null publishedAt → 0 (sorts last) — hence the explicit NULLS LAST; and no
    // receivedAt secondary, since the merge breaks publishedAt ties on id only.
    .orderBy(sql`${federatedContent.publishedAt} DESC NULLS LAST`, desc(federatedContent.id))
    .limit(maxItems);

  return rows.map((row): ContentListItem => ({
    id: row.fed.id,
    type: (row.fed.cpubType ?? row.fed.apType?.toLowerCase() ?? 'blog') as string,
    title: row.fed.title ?? 'Untitled',
    slug: `mirror-${row.fed.id.slice(0, 8)}`, // Placeholder slug for routing
    description: row.fed.summary,
    coverImageUrl: row.fed.coverImageUrl,
    status: 'published',
    difficulty: null,
    viewCount: 0,
    likeCount: row.fed.localLikeCount,
    commentCount: row.fed.localCommentCount,
    buildCount: 0,
    publishedAt: row.fed.publishedAt,
    createdAt: row.fed.receivedAt,
    author: {
      id: row.actor?.actorUri ?? row.fed.actorUri,
      username: row.actor?.preferredUsername ?? row.fed.actorUri.split('/').pop() ?? 'unknown',
      displayName: row.actor?.displayName ?? null,
      avatarUrl: row.actor?.avatarUrl ?? null,
    },
    source: 'federated',
    sourceDomain: row.fed.originDomain,
    sourceUri: row.fed.objectUri,
    federatedContentId: row.fed.id,
  }));
}

/**
 * Whether federated content may be merged into a feed for these filters.
 *
 * Federated rows live in `federated_content` and `queryFederatedAsListItems` only
 * honours a SUBSET of the filters (type, search, isHidden, deletedAt, allowedContentTypes,
 * cursor). Any filter it CANNOT apply must suppress the merge entirely — otherwise the
 * federated stream leaks past that filter. Concretely:
 *  - `authorId` / `followedBy` — federated rows have no local author/follow relationship,
 *    so an author or "following" feed would merge in unrelated remote content.
 *  - `featured` / `editorial` / `categoryId` / `difficulty` / `tag` — local-only columns
 *    the federated query ignores.
 * `type` and `search` ARE applied by the federated query, so they don't suppress.
 * `status`/`visibility` aren't gated here: federated content is always published+public,
 * and the caller restricts non-owner status to published (resolveContentQuery) — but a
 * privileged `status:'archived'` local view shouldn't pull federated published rows, so
 * we suppress on any non-'published' status too.
 *
 * Used by BOTH listContent (offset) and listContentKeyset so the two can't drift.
 */
function canMergeFederated(filters: ContentFilters): boolean {
  return !filters.authorId
    && !filters.followedBy
    && !filters.featured
    && !filters.editorial
    && !filters.categoryId
    && !filters.difficulty
    && !filters.tag
    && (!filters.status || filters.status === 'published');
}

/**
 * Build the local `content_items` WHERE conditions for a ContentFilters set.
 * Shared by the offset path ({@link listContent}) and the keyset path
 * ({@link listContentKeyset}) so both filter identically — the only difference
 * between the two is pagination (offset vs cursor), never the predicate.
 */
function buildContentConditions(db: DB, filters: ContentFilters): SQL[] {
  const conditions: SQL[] = [isNull(contentItems.deletedAt)];

  if (filters.status) {
    conditions.push(eq(contentItems.status, filters.status));
  }
  if (filters.type) {
    // For blog type, also match 'article' (transition: pre-migration rows may still have type='article')
    if (filters.type === 'blog') {
      conditions.push(sql`${contentItems.type} IN ('blog', 'article')`);
    } else {
      conditions.push(eq(contentItems.type, filters.type));
    }
  }
  if (filters.authorId) {
    conditions.push(eq(contentItems.authorId, filters.authorId));
  }
  if (filters.featured) {
    conditions.push(eq(contentItems.isFeatured, true));
  }
  if (filters.editorial) {
    conditions.push(eq(contentItems.isEditorial, true));
  }
  if (filters.categoryId) {
    conditions.push(eq(contentItems.categoryId, filters.categoryId));
  }
  if (filters.difficulty) {
    conditions.push(eq(contentItems.difficulty, filters.difficulty));
  }
  if (filters.search) {
    const searchPattern = `%${escapeLike(filters.search)}%`;
    conditions.push(
      sql`(${contentItems.title} ILIKE ${searchPattern} OR ${contentItems.description} ILIKE ${searchPattern})`,
    );
  }
  if (filters.followedBy) {
    conditions.push(
      inArray(
        contentItems.authorId,
        db.select({ id: follows.followingId })
          .from(follows)
          .where(eq(follows.followerId, filters.followedBy)),
      ),
    );
  }
  if (filters.visibility) {
    conditions.push(eq(contentItems.visibility, filters.visibility));
  }
  if (filters.tag) {
    conditions.push(
      sql`${contentItems.id} IN (
        SELECT ${contentTags.contentId} FROM ${contentTags}
        INNER JOIN ${tags} ON ${tags.id} = ${contentTags.tagId}
        WHERE ${tags.slug} = ${filters.tag}
      )`,
    );
  }

  return conditions;
}

export async function listContent(
  db: DB,
  filters: ContentFilters = {},
  options?: { includeFederated?: boolean; allowedContentTypes?: string[] },
): Promise<{ items: ContentListItem[]; total: number }> {
  const conditions = buildContentConditions(db, filters);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  // When we'll merge in federated content, the merged stream must be paginated
  // as a whole: fetch the first (offset+limit) of EACH source, merge+sort, then
  // slice [offset, offset+limit). Fetching only the local page + federated-from-0
  // (the old bug) re-showed the same early federated items on every "load more".
  const willFederate = !!options?.includeFederated && canMergeFederated(filters);
  const localLimit = willFederate ? offset + limit : limit;
  const localOffset = willFederate ? 0 : offset;

  // Every sort ends with a UNIQUE tiebreaker (`id`) so the ordering is a total
  // order. Without it, ties on the lead column (e.g. `viewCount = 0` for most
  // content under `sort: 'popular'`, or a bulk-imported `publishedAt`) leave
  // Postgres free to return tied rows in any order — which differs between the
  // page-1 and page-2 queries, so LIMIT/OFFSET pages OVERLAP and "load more"
  // re-shows rows (the homepage dup bug). createdAt is a near-unique secondary;
  // id is the absolute tiebreaker.
  const recencyOrder = [desc(contentItems.publishedAt), desc(contentItems.createdAt), desc(contentItems.id)];
  // When merging with federated content the feed is CHRONOLOGICAL, and the local
  // slice must order by EXACTLY the merge key — (publishedAt DESC, id DESC), no
  // createdAt secondary — because the merge breaks publishedAt ties on id only.
  // Any extra/different secondary here re-ranks publishedAt-ties differently from
  // the merge, so a local item the merge would place in globalTop-K can fall out
  // of localTop-K → the merge window is wrong → load-more dups (federated content
  // has no viewCount/isFeatured to rank by anyway). Local-only keeps the requested sort.
  const mergeLocalOrder = [desc(contentItems.publishedAt), desc(contentItems.id)];
  const orderBy = willFederate
    ? mergeLocalOrder
    : filters.sort === 'popular'
      ? [desc(contentItems.viewCount), desc(contentItems.createdAt), desc(contentItems.id)]
      : filters.sort === 'featured'
        ? [desc(contentItems.isFeatured), desc(contentItems.createdAt), desc(contentItems.id)]
        : filters.sort === 'editorial'
          ? [desc(contentItems.isEditorial), desc(contentItems.publishedAt), desc(contentItems.id)]
          : recencyOrder;

  const [rows, total] = await Promise.all([
    db
      .select({
        content: contentItems,
        author: USER_REF_SELECT,
        category: {
          name: contentCategories.name,
          slug: contentCategories.slug,
          color: contentCategories.color,
          icon: contentCategories.icon,
        },
      })
      .from(contentItems)
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .leftJoin(contentCategories, eq(contentItems.categoryId, contentCategories.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(localLimit)
      .offset(localOffset),
    // COUNT(*) only on the first page (pagination-scalability.md phase B): feed clients
    // detect "has more" via items.length < limit and never read `total`; numbered/admin
    // listings read it only on page 1. Deep load-more pages skip the full count. `-1` =
    // "not computed".
    localOffset === 0 ? countRows(db, contentItems, where) : Promise.resolve(-1),
  ]);

  const localItems: ContentListItem[] = rows.map((row) => ({
    ...mapToListItem(row.content, row.author, row.category),
    source: 'local' as const,
  }));

  // If seamless federation is off or filtering by author, return local-only results.
  // Federated content has no local authorId, so it must never appear in author-filtered views.
  if (!willFederate) {
    return { items: localItems, total };
  }

  // Query federated content (from mirrored instances) — the first (offset+limit),
  // matching the local window so the merge is a consistent slice of the stream.
  const fedItems = await queryFederatedAsListItems(db, filters, offset + limit, options?.allowedContentTypes);

  // Merge both windows and sort by publishedAt descending, then take THIS page's
  // slice [offset, offset+limit). Slicing from `offset` (not 0) is what makes
  // "load more" advance instead of re-showing the same merged head.
  const merged = [...localItems, ...fedItems].sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (bDate !== aDate) return bDate - aDate;
    // Stable tiebreaker on id so the merged order is total — otherwise items
    // sharing a publishedAt across the two sources can reorder between the
    // page-N and page-N+1 slices and re-appear ("load more" dup).
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

  // Approximate total (exact merged count needs a federated count query).
  // Preserve the `-1` "not computed" sentinel rather than turning it into a bogus count.
  return { items: merged.slice(offset, offset + limit), total: total === -1 ? -1 : total + fedItems.length };
}

/**
 * The single total order shared by the keyset feed: publishedAt DESC NULLS LAST,
 * then id DESC. The local SQL, the federated SQL, and this JS comparator MUST agree
 * byte-for-byte — a mismatch is the load-more-dup class of bug (see the offset path's
 * comments + the byte-align fix). null publishedAt sorts last (mapped to -Infinity);
 * id breaks the tie. Returns <0 if a sorts before b (a is "newer").
 */
function compareFeedOrder(a: ContentListItem, b: ContentListItem): number {
  const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : -Infinity;
  const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : -Infinity;
  if (aDate !== bDate) return bDate - aDate; // newer (larger) first
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0; // larger id first
}

/** Build the opaque cursor that points AT a given feed item (its publishedAt + id). */
function feedCursorFor(item: ContentListItem): string {
  return encodeCursor(item.publishedAt, item.id);
}

/**
 * Keyset (cursor) pagination for the chronological feed — O(limit) per page at any
 * depth, no COUNT, no offset. The elegant target of docs/plans/pagination-scalability.md.
 *
 * Order is fixed to recency (publishedAt DESC NULLS LAST, id DESC): a keyset cursor
 * requires a stable total order, and a merged local+federated feed is inherently
 * chronological (federated content has no viewCount). Non-recency sorts (popular/
 * featured/editorial) stay on the offset path ({@link listContent}) — they are
 * shallow, instance-local listing views, not infinite-scroll feeds.
 *
 * Federated case = keyset-merge: fetch limit+1 from EACH source past the cursor in
 * the shared order, merge the two sorted streams, take limit. The (limit+1)th merged
 * row proves hasMore without a COUNT. This structurally removes the offset-window
 * fragility and the O(M²) re-scan of the offset merge.
 *
 * @returns items + nextCursor (null when the feed is exhausted).
 */
export async function listContentKeyset(
  db: DB,
  filters: Omit<ContentFilters, 'offset' | 'sort'> & { cursor?: string | null } = {},
  options?: { includeFederated?: boolean; allowedContentTypes?: string[] },
): Promise<{ items: ContentListItem[]; nextCursor: string | null }> {
  const conditions = buildContentConditions(db, filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  // Clamp to [1, 100]. A 0/negative limit would make `.limit(limit + 1)` <= 0; Postgres
  // rejects a negative LIMIT (→ 500), and limit 0 is a nonsense feed page. `?? 20` only
  // covers undefined; an explicit 0/NaN/<1 is floored to 1 by Math.max (Number.isFinite
  // guards NaN, which Math.max would otherwise propagate).
  const rawLimit = Math.trunc(filters.limit ?? 20);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
  // Decode + DOMAIN-validate the cursor: the feed is date-keyed with a uuid id, so reject
  // any cursor whose v isn't a date/null or whose id isn't a uuid. Without this a crafted
  // `?cursor=` (bad date, numeric v, non-uuid id) reaches the SQL bind and throws → 500
  // (an unauthenticated DoS). Invalid → null → first page (decodeCursor's contract).
  const cursor = asDateUuidCursor(decodeCursor(filters.cursor));

  // Same gate as the offset path (shared helper so the two can't drift): suppress the
  // federated merge for any filter the federated query can't honour (author/following/
  // featured/editorial/category/difficulty/tag/non-published status).
  const willFederate = !!options?.includeFederated && canMergeFederated(filters);

  // Local slice: limit+1 rows past the cursor in the shared order. The +1 row is the
  // hasMore probe and (in the federated case) headroom for the merge.
  const localWhere = cursor
    ? and(where, keysetWhere(contentItems.publishedAt, contentItems.id, cursor))
    : where;
  const localRows = await db
    .select({
      content: contentItems,
      author: USER_REF_SELECT,
      category: {
        name: contentCategories.name,
        slug: contentCategories.slug,
        color: contentCategories.color,
        icon: contentCategories.icon,
      },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .leftJoin(contentCategories, eq(contentItems.categoryId, contentCategories.id))
    .where(localWhere)
    .orderBy(sql`${contentItems.publishedAt} DESC NULLS LAST`, desc(contentItems.id))
    .limit(limit + 1);

  const localItems: ContentListItem[] = localRows.map((row) => ({
    ...mapToListItem(row.content, row.author, row.category),
    source: 'local' as const,
  }));

  let pool: ContentListItem[];
  if (willFederate) {
    // Federated slice: limit+1 past the SAME cursor in the SAME order.
    const fedItems = await queryFederatedAsListItems(db, filters, limit + 1, options?.allowedContentTypes, cursor);
    // Merge the two already-sorted streams and keep the head. Both sources are bounded
    // at limit+1, so the merged pool is at most 2*(limit+1) — O(limit), no O(M²).
    pool = [...localItems, ...fedItems].sort(compareFeedOrder);
  } else {
    pool = localItems;
  }

  // hasMore iff a (limit+1)th item exists in the head of the ordered pool.
  const hasMore = pool.length > limit;
  const items = pool.slice(0, limit);
  const nextCursor = hasMore && items.length > 0 ? feedCursorFor(items[items.length - 1]!) : null;
  return { items, nextCursor };
}

export async function getContentBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
  /** Optional author username to disambiguate when slugs are not globally unique */
  authorUsername?: string,
  /** Optional author ID to disambiguate (used by internal callers that have authorId but not username) */
  authorId?: string,
): Promise<ContentDetail | null> {
  const conditions: SQL[] = [eq(contentItems.slug, slug), isNull(contentItems.deletedAt)];
  if (authorUsername) {
    conditions.push(eq(users.username, authorUsername));
  }
  if (authorId) {
    conditions.push(eq(contentItems.authorId, authorId));
  }

  const rows = await db
    .select({
      content: contentItems,
      author: USER_REF_WITH_HEADLINE_SELECT,
      category: {
        name: contentCategories.name,
        slug: contentCategories.slug,
        color: contentCategories.color,
        icon: contentCategories.icon,
      },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .leftJoin(contentCategories, eq(contentItems.categoryId, contentCategories.id))
    .where(and(...conditions))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  const item = row.content;

  // Non-published content only visible to author
  if (item.status !== 'published' && item.authorId !== requesterId) {
    return null;
  }

  // Fetch tags, author stats, and related content in parallel
  const [itemTags, followerCountResult, articleCountResult, totalViewsResult, relatedRows] = await Promise.all([
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(contentTags)
      .innerJoin(tags, eq(contentTags.tagId, tags.id))
      .where(eq(contentTags.contentId, item.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, row.author.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentItems)
      .where(and(eq(contentItems.authorId, row.author.id), eq(contentItems.status, 'published'))),
    db
      .select({ total: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::int` })
      .from(contentItems)
      .where(eq(contentItems.authorId, row.author.id)),
    db
      .select({
        id: contentItems.id,
        type: contentItems.type,
        slug: contentItems.slug,
        title: contentItems.title,
        viewCount: contentItems.viewCount,
        coverImageUrl: contentItems.coverImageUrl,
        author: { username: users.username },
      })
      .from(contentItems)
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(
        and(
          eq(contentItems.type, item.type),
          eq(contentItems.status, 'published'),
          sql`${contentItems.id} != ${item.id}`,
        ),
      )
      .orderBy(desc(contentItems.publishedAt))
      .limit(3),
  ]);

  const enrichedAuthor = {
    ...row.author,
    followerCount: followerCountResult[0]?.count ?? 0,
    articleCount: articleCountResult[0]?.count ?? 0,
    totalViews: totalViewsResult[0]?.total ?? 0,
  };

  return {
    ...mapToListItem(item, enrichedAuthor, row.category),
    subtitle: item.subtitle,
    content: item.content,
    bannerUrl: item.bannerUrl,
    category: item.category,
    buildTime: item.buildTime,
    estimatedCost: item.estimatedCost,
    estimatedMinutes: item.estimatedMinutes,
    licenseType: item.licenseType,
    series: item.series,
    visibility: item.visibility,
    isFeatured: item.isFeatured,
    seoDescription: item.seoDescription,
    previewToken: item.previewToken,
    parts: item.parts,
    sections: item.sections,
    forkCount: item.forkCount,
    scheduledAt: item.scheduledAt,
    updatedAt: item.updatedAt,
    tags: itemTags,
    author: enrichedAuthor,
    related: relatedRows,
  };
}

export async function createContent(
  db: DB,
  authorId: string,
  input: CreateContentInput,
): Promise<ContentDetail> {
  // Normalize 'article' → 'blog' (article type merged into blog)
  // Preserve 'article' as category when no category specified
  const normalizedType = input.type === 'article' ? 'blog' : input.type;
  const normalizedCategory = input.type === 'article' && !input.category ? 'article' : input.category;

  // Honor an author-supplied custom slug (normalized); otherwise derive from title.
  const slug = await ensureUniqueSlugFor(
    db, contentItems, contentItems.slug, contentItems.id,
    generateSlug(input.slug || input.title), 'untitled', undefined,
    [{ col: contentItems.authorId, value: authorId }, { col: contentItems.type, value: normalizedType }],
  );
  const previewToken = crypto.randomUUID().replace(/-/g, '');

  const [item] = await db
    .insert(contentItems)
    .values({
      authorId,
      type: normalizedType,
      title: input.title,
      slug,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      content: (await sanitizeBlockContent(input.content)) ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      category: normalizedCategory ?? null,
      difficulty: input.difficulty ?? null,
      buildTime: input.buildTime ?? null,
      estimatedCost: input.estimatedCost ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      licenseType: input.licenseType ?? null,
      series: input.series ?? null,
      visibility: input.visibility ?? 'public',
      seoDescription: input.seoDescription ?? null,
      sections: input.sections as typeof contentItems.$inferInsert.sections ?? null,
      categoryId: input.categoryId ?? null,
      status: 'draft',
      scheduledAt: input.scheduledAt ?? null,
      previewToken,
    })
    .returning();

  if (input.tags?.length) {
    await syncTags(db, item!.id, input.tags);
  }

  return (await getContentBySlug(db, item!.slug, authorId, undefined, authorId))!;
}

export async function updateContent(
  db: DB,
  contentId: string,
  authorId: string,
  input: UpdateContentInput,
): Promise<ContentDetail | null> {
  // Ownership check
  const existing = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, contentId), eq(contentItems.authorId, authorId)))
    .limit(1);

  if (existing.length === 0) return null;

  const current = existing[0]!;
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updates.title = input.title;

  // Re-slug when the author supplies a custom slug, or (only otherwise) when the
  // title changes. A custom slug always wins so editing it is never a silent no-op.
  const slugSource = input.slug && input.slug.trim() !== ''
    ? input.slug
    : (input.title !== undefined && input.title !== current.title ? input.title : undefined);
  if (slugSource !== undefined) {
    updates.slug = await ensureUniqueSlugFor(
      db, contentItems, contentItems.slug, contentItems.id,
      generateSlug(slugSource), 'untitled', contentId,
      [{ col: contentItems.authorId, value: authorId }, { col: contentItems.type, value: current.type }],
    );
  }
  if (input.subtitle !== undefined) updates.subtitle = input.subtitle;
  if (input.description !== undefined) updates.description = input.description;
  if (input.content !== undefined) updates.content = await sanitizeBlockContent(input.content);
  if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl;
  if (input.bannerUrl !== undefined) updates.bannerUrl = input.bannerUrl;
  if (input.category !== undefined) updates.category = input.category;
  if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
  if (input.seoDescription !== undefined) updates.seoDescription = input.seoDescription;
  if (input.sections !== undefined) updates.sections = input.sections;
  if (input.buildTime !== undefined) updates.buildTime = input.buildTime;
  if (input.estimatedCost !== undefined) updates.estimatedCost = input.estimatedCost;
  if (input.estimatedMinutes !== undefined) updates.estimatedMinutes = input.estimatedMinutes;
  if (input.licenseType !== undefined) updates.licenseType = input.licenseType;
  if (input.series !== undefined) updates.series = input.series;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
  if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt;

  if (input.status !== undefined) {
    if (input.status === 'scheduled') {
      // Hold the same invariants the dedicated schedule endpoint enforces, so the
      // generic update path can't unpublish a live post or strand it as
      // status='scheduled' with no time (which would hide it from feeds forever).
      if (current.status !== 'draft' && current.status !== 'scheduled') {
        throw new Error('Only draft content can be scheduled');
      }
      const effectiveScheduledAt = input.scheduledAt ?? (current.scheduledAt as Date | null);
      if (!effectiveScheduledAt) {
        throw new Error('Scheduling requires a scheduledAt time');
      }
    }
    updates.status = input.status;
    if (input.status === 'published' && !current.publishedAt) {
      updates.publishedAt = new Date();
    }
    // Leaving 'scheduled' or publishing clears any pending schedule timestamp
    // unless the caller is explicitly (re)scheduling in this same update.
    if (input.status !== 'scheduled' && input.scheduledAt === undefined) {
      updates.scheduledAt = null;
    }
  }

  await db.update(contentItems).set(updates).where(eq(contentItems.id, contentId));

  if (input.tags !== undefined) {
    await syncTags(db, contentId, input.tags);
  }

  const slug = (updates.slug as string) ?? current.slug;
  return (await getContentBySlug(db, slug, authorId, undefined, authorId))!;
}

export async function deleteContent(db: DB, contentId: string, authorId: string): Promise<boolean> {
  const result = await db
    .update(contentItems)
    .set({ status: 'archived', deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contentItems.id, contentId), eq(contentItems.authorId, authorId)));

  return (result.rowCount ?? 0) > 0;
}

export async function publishContent(
  db: DB,
  contentId: string,
  authorId: string,
): Promise<ContentDetail | null> {
  // Create a version snapshot before publishing
  await createContentVersion(db, contentId, authorId);
  return updateContent(db, contentId, authorId, { status: 'published' });
}

/**
 * Schedule a content item to auto-publish at a future time. Sets status to
 * 'scheduled' and stores the target time; the scheduled-publishing worker
 * (publishDueScheduled) flips it to 'published' once that time passes. Ownership
 * is enforced by updateContent (returns null for non-owners).
 */
export async function scheduleContent(
  db: DB,
  contentId: string,
  authorId: string,
  scheduledAt: Date,
): Promise<ContentDetail | null> {
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid scheduled time');
  }
  // Only unpublished content may be scheduled. Without this guard, "scheduling"
  // a live post would set status back to 'scheduled' and silently unpublish it.
  const [current] = await db
    .select({ status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.id, contentId), eq(contentItems.authorId, authorId)))
    .limit(1);
  if (!current) return null;
  if (current.status !== 'draft' && current.status !== 'scheduled') return null;

  return updateContent(db, contentId, authorId, { status: 'scheduled', scheduledAt });
}

/**
 * Scheduled-publishing worker step. Atomically claims every content item whose
 * scheduled time has passed via a single `UPDATE ... RETURNING` — Postgres row
 * locks guarantee each row is flipped to 'published' exactly once, so this is
 * safe to run concurrently across replicas. The normal publish side effects
 * (version snapshot + federation/search/hooks) then run per claimed item.
 *
 * Returns the number of items published.
 */
export async function publishDueScheduled(
  db: DB,
  config: CommonPubConfig,
  now: Date = new Date(),
): Promise<number> {
  const claimed = await db
    .update(contentItems)
    .set({
      status: 'published',
      publishedAt: sql`COALESCE(${contentItems.publishedAt}, ${now})`,
      scheduledAt: null,
      updatedAt: now,
    })
    .where(and(
      eq(contentItems.status, 'scheduled'),
      isNull(contentItems.deletedAt),
      lte(contentItems.scheduledAt, now),
    ))
    .returning({ id: contentItems.id, authorId: contentItems.authorId });

  for (const item of claimed) {
    try {
      await createContentVersion(db, item.id, item.authorId);
      await onContentPublished(db, item.id, config);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scheduled-publishing] post-publish side effects failed for ${item.id}:`, message);
    }
  }

  return claimed.length;
}

// --- Content Versioning ---

export async function createContentVersion(
  db: DB,
  contentId: string,
  userId: string,
): Promise<{ id: string; version: number }> {
  return db.transaction(async (tx) => {
    // Lock the parent row so concurrent version creates serialize per content,
    // preventing duplicate version numbers (no unique constraint by design).
    const content = await tx
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .for('update')
      .limit(1);

    if (content.length === 0) throw new Error('Content not found');

    const item = content[0]!;

    // Get next version number
    const [lastVersion] = await tx
      .select({ version: contentVersions.version })
      .from(contentVersions)
      .where(eq(contentVersions.contentId, contentId))
      .orderBy(desc(contentVersions.version))
      .limit(1);

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const [row] = await tx
      .insert(contentVersions)
      .values({
        contentId,
        version: nextVersion,
        title: item.title,
        content: item.content,
        metadata: {
          subtitle: item.subtitle,
          description: item.description,
          category: item.category,
          difficulty: item.difficulty,
          buildTime: item.buildTime,
          estimatedCost: item.estimatedCost,
          coverImageUrl: item.coverImageUrl,
          parts: item.parts,
          sections: item.sections,
        },
        createdById: userId,
      })
      .returning({ id: contentVersions.id, version: contentVersions.version });

    return { id: row!.id, version: row!.version };
  });
}

export interface ContentVersionItem {
  id: string;
  version: number;
  title: string | null;
  createdAt: Date;
  createdBy: { id: string; username: string; displayName: string | null };
}

export async function listContentVersions(
  db: DB,
  contentId: string,
): Promise<ContentVersionItem[]> {
  const rows = await db
    .select({
      version: contentVersions,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(contentVersions)
    .innerJoin(users, eq(contentVersions.createdById, users.id))
    .where(eq(contentVersions.contentId, contentId))
    .orderBy(desc(contentVersions.version));

  return rows.map((row) => ({
    id: row.version.id,
    version: row.version.version,
    title: row.version.title,
    createdAt: row.version.createdAt,
    createdBy: row.user,
  }));
}

export async function incrementViewCount(db: DB, contentId: string): Promise<void> {
  await db
    .update(contentItems)
    .set({ viewCount: sql`${contentItems.viewCount} + 1` })
    .where(eq(contentItems.id, contentId));
}

async function syncTags(db: DB, contentId: string, tagNames: string[]): Promise<void> {
  // Remove existing tags
  await db.delete(contentTags).where(eq(contentTags.contentId, contentId));

  if (tagNames.length === 0) return;

  // Deduplicate and generate slugs
  const tagEntries = tagNames
    .map((name) => ({ name, slug: generateSlug(name) }))
    .filter((t) => t.slug);

  if (tagEntries.length === 0) return;

  const slugs = tagEntries.map((t) => t.slug);

  // Batch upsert: insert any new tags, ignore conflicts on existing slugs
  await db
    .insert(tags)
    .values(tagEntries.map((t) => ({ name: t.name, slug: t.slug })))
    .onConflictDoNothing({ target: tags.slug });

  // Fetch all tag rows in one query
  const tagRows = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, slugs));

  // Create content-tag associations
  if (tagRows.length > 0) {
    await db.insert(contentTags).values(tagRows.map((tag) => ({ contentId, tagId: tag.id })));
  }
}

// --- Build Mark ---

export async function toggleBuildMark(
  db: DB,
  contentId: string,
  userId: string,
): Promise<{ marked: boolean; count: number }> {
  const result = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(contentBuilds)
      .where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await tx
        .delete(contentBuilds)
        .where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId)));
      const [updated] = await tx
        .update(contentItems)
        .set({ buildCount: sql`GREATEST(${contentItems.buildCount} - 1, 0)` })
        .where(eq(contentItems.id, contentId))
        .returning({ buildCount: contentItems.buildCount });
      return { marked: false, count: updated?.buildCount ?? 0 };
    }

    // ON CONFLICT DO NOTHING so a concurrent double-click doesn't hit the
    // content_builds_user_content UNIQUE and throw an uncaught 500 (same
    // race class as rsvpEvent). If the row already existed, another request
    // already incremented — return the current count without double-counting.
    const inserted = await tx
      .insert(contentBuilds)
      .values({ contentId, userId })
      .onConflictDoNothing()
      .returning({ id: contentBuilds.id });

    if (inserted.length === 0) {
      const [row] = await tx
        .select({ buildCount: contentItems.buildCount })
        .from(contentItems)
        .where(eq(contentItems.id, contentId))
        .limit(1);
      return { marked: true, count: row?.buildCount ?? 0 };
    }

    const [updated] = await tx
      .update(contentItems)
      .set({ buildCount: sql`${contentItems.buildCount} + 1` })
      .where(eq(contentItems.id, contentId))
      .returning({ buildCount: contentItems.buildCount, authorId: contentItems.authorId, title: contentItems.title, slug: contentItems.slug, type: contentItems.type });

    return { marked: true, count: updated?.buildCount ?? 0, authorId: updated?.authorId, title: updated?.title, slug: updated?.slug, type: updated?.type };
  });

  // Notify content author AFTER transaction completes (avoids single-connection deadlock)
  if (result.marked && result.authorId && result.authorId !== userId) {
    try {
      const [actor] = await db.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
      const [contentAuthor] = await db.select({ username: users.username }).from(users).where(eq(users.id, result.authorId)).limit(1);
      const actorName = actor?.displayName || actor?.username || 'Someone';
      await createNotification(db, {
        userId: result.authorId,
        type: 'build',
        title: 'Someone built this!',
        message: `${actorName} marked "I built this" on "${result.title ?? 'your content'}"`,
        link: buildContentPath(contentAuthor?.username ?? '', result.type!, result.slug!),
        actorId: userId,
      });
    } catch { /* non-critical */ }
  }

  return { marked: result.marked, count: result.count };
}

export async function isBuildMarked(
  db: DB,
  contentId: string,
  userId: string,
): Promise<boolean> {
  const existing = await db
    .select()
    .from(contentBuilds)
    .where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId)))
    .limit(1);
  return existing.length > 0;
}

// --- Fork ---

export async function forkContent(
  db: DB,
  sourceId: string,
  userId: string,
): Promise<ContentDetail> {
  const source = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, sourceId))
    .limit(1);

  if (source.length === 0) {
    throw new Error('Source content not found');
  }

  const item = source[0]!;
  const previewToken = crypto.randomUUID().replace(/-/g, '');

  // Wrap the three writes (insert fork item, link fork, bump source forkCount)
  // in one transaction so a partial failure can't orphan a fork.
  const forked = await db.transaction(async (tx) => {
    const slug = await ensureUniqueSlugFor(
      tx, contentItems, contentItems.slug, contentItems.id,
      `${item.slug}-fork-${Date.now()}`, 'fork', undefined,
      [{ col: contentItems.authorId, value: userId }, { col: contentItems.type, value: item.type }],
    );

    const [inserted] = await tx
      .insert(contentItems)
      .values({
        authorId: userId,
        type: item.type,
        title: `${item.title} (Fork)`,
        slug,
        subtitle: item.subtitle,
        description: item.description,
        content: item.content,
        coverImageUrl: item.coverImageUrl,
        category: item.category,
        categoryId: item.categoryId,
        difficulty: item.difficulty,
        buildTime: item.buildTime,
        estimatedCost: item.estimatedCost,
        visibility: 'public',
        seoDescription: item.seoDescription,
        sections: item.sections,
        parts: item.parts,
        status: 'draft',
        previewToken,
      })
      .returning();

    await tx.insert(contentForks).values({
      sourceId,
      forkId: inserted!.id,
    });

    await tx
      .update(contentItems)
      .set({ forkCount: sql`${contentItems.forkCount} + 1` })
      .where(eq(contentItems.id, sourceId));

    return inserted!;
  });

  // Notify original author about fork (non-critical)
  try {
    if (item.authorId !== userId) {
      const [actor] = await db.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
      const [itemAuthor] = await db.select({ username: users.username }).from(users).where(eq(users.id, item.authorId)).limit(1);
      const actorName = actor?.displayName || actor?.username || 'Someone';
      await createNotification(db, {
        userId: item.authorId,
        type: 'fork',
        title: 'Content forked',
        message: `${actorName} forked "${item.title ?? 'your content'}"`,
        link: buildContentPath(itemAuthor?.username ?? '', item.type, item.slug),
        actorId: userId,
      });
    }
  } catch { /* non-critical */ }

  return (await getContentBySlug(db, forked.slug, userId, undefined, userId))!;
}

// --- Federated Content: Fork & Build ---

export async function forkFederatedContent(
  db: DB,
  federatedContentId: string,
  userId: string,
): Promise<ContentDetail> {
  const source = await db
    .select()
    .from(federatedContent)
    .where(eq(federatedContent.id, federatedContentId))
    .limit(1);

  if (source.length === 0) {
    throw new Error('Federated content not found');
  }

  const fc = source[0]!;
  const titleBase = fc.title || 'Untitled';
  const slugBase = titleBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const forkType = (fc.cpubType || 'project') as 'project' | 'article' | 'blog' | 'explainer';
  const slug = await ensureUniqueSlugFor(
    db, contentItems, contentItems.slug, contentItems.id,
    `${slugBase}-fork-${Date.now()}`, 'fork', undefined,
    [{ col: contentItems.authorId, value: userId }, { col: contentItems.type, value: forkType }],
  );
  const previewToken = crypto.randomUUID().replace(/-/g, '');

  const meta = fc.cpubMetadata as Record<string, unknown> | null;

  const [forked] = await db
    .insert(contentItems)
    .values({
      authorId: userId,
      type: forkType,
      title: `${titleBase} (Fork)`,
      slug,
      description: fc.summary,
      content: fc.cpubBlocks ?? fc.content,
      coverImageUrl: fc.coverImageUrl,
      difficulty: (meta?.difficulty as 'beginner' | 'intermediate' | 'advanced') ?? null,
      buildTime: (meta?.buildTime as string) ?? null,
      estimatedCost: (meta?.estimatedCost as string) ?? null,
      visibility: 'public',
      status: 'draft',
      previewToken,
    })
    .returning();

  return (await getContentBySlug(db, forked!.slug, userId, undefined, userId))!;
}

export async function toggleFederatedBuildMark(
  db: DB,
  federatedContentId: string,
  userId: string,
): Promise<{ marked: boolean; count: number }> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(federatedContentBuilds)
      .where(and(eq(federatedContentBuilds.federatedContentId, federatedContentId), eq(federatedContentBuilds.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await tx
        .delete(federatedContentBuilds)
        .where(and(eq(federatedContentBuilds.federatedContentId, federatedContentId), eq(federatedContentBuilds.userId, userId)));
      // No denormalized counter on federatedContent — count from table
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(federatedContentBuilds)
        .where(eq(federatedContentBuilds.federatedContentId, federatedContentId));
      return { marked: false, count: rows[0]?.count ?? 0 };
    }

    await tx.insert(federatedContentBuilds).values({ federatedContentId, userId });
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(federatedContentBuilds)
      .where(eq(federatedContentBuilds.federatedContentId, federatedContentId));
    return { marked: true, count: rows[0]?.count ?? 0 };
  });
}

export async function isFederatedBuildMarked(
  db: DB,
  federatedContentId: string,
  userId: string,
): Promise<boolean> {
  const existing = await db
    .select()
    .from(federatedContentBuilds)
    .where(and(eq(federatedContentBuilds.federatedContentId, federatedContentId), eq(federatedContentBuilds.userId, userId)))
    .limit(1);
  return existing.length > 0;
}

// --- Federation Hooks ---
// Called by route handlers after content mutations when federation is enabled

export async function onContentPublished(
  db: DB,
  contentId: string,
  config: CommonPubConfig,
): Promise<{ federated: boolean; error?: string }> {
  // Emit hook for consumer extensions
  const [content] = await db
    .select({
      authorId: contentItems.authorId,
      type: contentItems.type,
      slug: contentItems.slug,
      apObjectId: contentItems.apObjectId,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  if (content) {
    await emitHook('content:published', {
      db, contentId, authorId: content.authorId, contentType: content.type, slug: content.slug,
    });

    // Stamp the canonical AP object URI on first publish (immutable after this)
    if (!content.apObjectId && config.instance.domain) {
      const [author] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, content.authorId))
        .limit(1);
      if (author) {
        const apObjectId = `https://${config.instance.domain}/u/${author.username}/${content.type}/${content.slug}`;
        await db.update(contentItems).set({ apObjectId }).where(eq(contentItems.id, contentId));
      }
    }
  }

  if (!config.features.federation) return { federated: false };
  try {
    await federateContent(db, contentId, config.instance.domain);
    return { federated: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[federation] publish:', message);
    return { federated: false, error: message };
  }
}

export async function onContentUpdated(
  db: DB,
  contentId: string,
  config: CommonPubConfig,
): Promise<{ federated: boolean; error?: string }> {
  const [content] = await db
    .select({ authorId: contentItems.authorId })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  if (content) {
    await emitHook('content:updated', { db, contentId, authorId: content.authorId });
  }

  if (!config.features.federation) return { federated: false };
  try {
    await federateUpdate(db, contentId, config.instance.domain);
    return { federated: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[federation] update:', message);
    return { federated: false, error: message };
  }
}

export async function onContentDeleted(
  db: DB,
  contentId: string,
  authorUsername: string,
  config: CommonPubConfig,
): Promise<void> {
  const [content] = await db
    .select({ authorId: contentItems.authorId })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  if (content) {
    await emitHook('content:deleted', { db, contentId, authorId: content.authorId });
  }

  if (!config.features.federation) return;
  await federateDelete(db, contentId, config.instance.domain, authorUsername).catch(
    (err: unknown) => {
      console.error('[federation]', err);
    },
  );
}
