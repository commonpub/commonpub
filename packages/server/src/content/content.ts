import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { contentItems, contentVersions, contentForks, contentBuilds, federatedContentBuilds, tags, contentTags, users, follows, federatedContent, remoteActors } from '@commonpub/schema';
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
import { ensureUniqueSlugFor, USER_REF_SELECT, USER_REF_WITH_HEADLINE_SELECT, normalizePagination, countRows, escapeLike, buildContentPath } from '../query.js';
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
): Promise<ContentListItem[]> {
  const conditions = [
    isNull(federatedContent.deletedAt),
    eq(federatedContent.isHidden, false),
  ];

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
    .orderBy(desc(federatedContent.publishedAt), desc(federatedContent.receivedAt))
    .limit(maxItems);

  return rows.map((row): ContentListItem => ({
    id: row.fed.id,
    type: (row.fed.cpubType ?? row.fed.apType?.toLowerCase() ?? 'article') as string,
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

export async function listContent(
  db: DB,
  filters: ContentFilters = {},
  options?: { includeFederated?: boolean; allowedContentTypes?: string[] },
): Promise<{ items: ContentListItem[]; total: number }> {
  const conditions = [isNull(contentItems.deletedAt)];

  if (filters.status) {
    conditions.push(eq(contentItems.status, filters.status));
  }
  if (filters.type) {
    conditions.push(
      eq(contentItems.type, filters.type),
    );
  }
  if (filters.authorId) {
    conditions.push(eq(contentItems.authorId, filters.authorId));
  }
  if (filters.featured) {
    conditions.push(eq(contentItems.isFeatured, true));
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

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select({
        content: contentItems,
        author: USER_REF_SELECT,
      })
      .from(contentItems)
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(where)
      .orderBy(
        ...(filters.sort === 'popular'
          ? [desc(contentItems.viewCount)]
          : filters.sort === 'featured'
            ? [desc(contentItems.isFeatured), desc(contentItems.createdAt)]
            : [desc(contentItems.publishedAt), desc(contentItems.createdAt)]),
      )
      .limit(limit)
      .offset(offset),
    countRows(db, contentItems, where),
  ]);

  const localItems: ContentListItem[] = rows.map((row) => ({
    ...mapToListItem(row.content, row.author),
    source: 'local' as const,
  }));

  // If seamless federation is off or filtering by author, return local-only results.
  // Federated content has no local authorId, so it must never appear in author-filtered views.
  if (!options?.includeFederated || filters.authorId || filters.featured) {
    return { items: localItems, total };
  }

  // Query federated content (from mirrored instances)
  // Fetch enough to fill the requested page after merging with local results
  const fedItems = await queryFederatedAsListItems(db, filters, offset + limit, options?.allowedContentTypes);

  // Merge all items and sort by publishedAt descending
  const merged = [...localItems, ...fedItems].sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bDate - aDate;
  });

  // Return the first `limit` items (both sources were already filtered/sorted by DB)
  // Note: this is approximate pagination — exact counts require a separate count query
  return { items: merged.slice(0, limit), total: total + fedItems.length };
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
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
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
    ...mapToListItem(item, enrichedAuthor),
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
  const slug = await ensureUniqueSlugFor(
    db, contentItems, contentItems.slug, contentItems.id,
    generateSlug(input.title), 'untitled', undefined,
    [{ col: contentItems.authorId, value: authorId }, { col: contentItems.type, value: input.type }],
  );
  const previewToken = crypto.randomUUID().replace(/-/g, '');

  const [item] = await db
    .insert(contentItems)
    .values({
      authorId,
      type: input.type,
      title: input.title,
      slug,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      content: (await sanitizeBlockContent(input.content)) ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      category: input.category ?? null,
      difficulty: input.difficulty ?? null,
      buildTime: input.buildTime ?? null,
      estimatedCost: input.estimatedCost ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      licenseType: input.licenseType ?? null,
      series: input.series ?? null,
      visibility: input.visibility ?? 'public',
      seoDescription: input.seoDescription ?? null,
      sections: input.sections as typeof contentItems.$inferInsert.sections ?? null,
      status: 'draft',
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

  if (input.title !== undefined) {
    updates.title = input.title;
    if (input.title !== current.title) {
      updates.slug = await ensureUniqueSlugFor(
        db, contentItems, contentItems.slug, contentItems.id,
        generateSlug(input.title), 'untitled', contentId,
        [{ col: contentItems.authorId, value: authorId }, { col: contentItems.type, value: current.type }],
      );
    }
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

  // Track status transition for federation
  const wasPublished = current.status === 'published';

  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === 'published' && !current.publishedAt) {
      updates.publishedAt = new Date();
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

// --- Content Versioning ---

export async function createContentVersion(
  db: DB,
  contentId: string,
  userId: string,
): Promise<{ id: string; version: number }> {
  const content = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (content.length === 0) throw new Error('Content not found');

  const item = content[0]!;

  // Get next version number
  const [lastVersion] = await db
    .select({ version: contentVersions.version })
    .from(contentVersions)
    .where(eq(contentVersions.contentId, contentId))
    .orderBy(desc(contentVersions.version))
    .limit(1);

  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const [row] = await db
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

    await tx.insert(contentBuilds).values({ contentId, userId });
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
  const slug = await ensureUniqueSlugFor(
    db, contentItems, contentItems.slug, contentItems.id,
    `${item.slug}-fork-${Date.now()}`, 'fork', undefined,
    [{ col: contentItems.authorId, value: userId }, { col: contentItems.type, value: item.type }],
  );
  const previewToken = crypto.randomUUID().replace(/-/g, '');

  const [forked] = await db
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

  await db.insert(contentForks).values({
    sourceId,
    forkId: forked!.id,
  });

  await db
    .update(contentItems)
    .set({ forkCount: sql`${contentItems.forkCount} + 1` })
    .where(eq(contentItems.id, sourceId));

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

  return (await getContentBySlug(db, forked!.slug, userId, undefined, userId))!;
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

/**
 * Check if a content update represents an unpublish (published → draft/archived).
 * If so, call onContentDeleted to send a Delete activity.
 */
export async function onContentStatusChange(
  db: DB,
  contentId: string,
  previousStatus: string,
  newStatus: string,
  authorUsername: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  // Unpublish: was published, now isn't
  if (previousStatus === 'published' && newStatus !== 'published') {
    await federateDelete(db, contentId, config.instance.domain, authorUsername).catch(
      (err: unknown) => { console.error('[federation] unpublish delete:', err); },
    );
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
