import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { contentItems, contentVersions, contentForks, contentBuilds, tags, contentTags, users, follows } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { ContentItemRow } from '@commonpub/schema';
import type {
  DB,
  ContentListItem,
  ContentDetail,
  ContentFilters,
  UserRef,
} from './types.js';
import type { CreateContentInput, UpdateContentInput } from '@commonpub/schema';
import { generateSlug, ensureUniqueSlug } from './utils.js';
import { federateContent, federateUpdate, federateDelete } from './federation.js';

/** Sanitize HTML strings within block content to prevent XSS */
/** Sanitize HTML strings within block content to prevent XSS */
async function sanitizeBlockContent(content: unknown): Promise<unknown> {
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
    console.warn('[sanitize] DOMPurify unavailable, HTML passed through unsanitized:', err instanceof Error ? err.message : err);
    return content;
  }

  return blocks.map(([type, data]) => {
    const sanitized = { ...data };
    if (typeof sanitized.html === 'string' && sanitized.html) {
      sanitized.html = sanitize(sanitized.html);
    }
    return [type, sanitized];
  });
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
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    author,
  };
}

export async function listContent(
  db: DB,
  filters: ContentFilters = {},
): Promise<{ items: ContentListItem[]; total: number }> {
  const conditions = [];

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
    const searchPattern = `%${filters.search}%`;
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
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        content: contentItems,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
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
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentItems)
      .where(where),
  ]);

  const items = rows.map((row) => mapToListItem(row.content, row.author));
  const total = countResult[0]?.count ?? 0;

  return { items, total };
}

export async function getContentBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
): Promise<ContentDetail | null> {
  const rows = await db
    .select({
      content: contentItems,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        headline: users.headline,
      },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(eq(contentItems.slug, slug))
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
      })
      .from(contentItems)
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
    category: item.category,
    buildTime: item.buildTime,
    estimatedCost: item.estimatedCost,
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
  const slug = await ensureUniqueSlug(db, generateSlug(input.title));
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
      category: input.category ?? null,
      difficulty: input.difficulty ?? null,
      buildTime: input.buildTime ?? null,
      estimatedCost: input.estimatedCost ?? null,
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

  return (await getContentBySlug(db, item!.slug, authorId))!;
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
      updates.slug = await ensureUniqueSlug(db, generateSlug(input.title), contentId);
    }
  }
  if (input.subtitle !== undefined) updates.subtitle = input.subtitle;
  if (input.description !== undefined) updates.description = input.description;
  if (input.content !== undefined) updates.content = await sanitizeBlockContent(input.content);
  if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl;
  if (input.category !== undefined) updates.category = input.category;
  if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
  if (input.seoDescription !== undefined) updates.seoDescription = input.seoDescription;
  if (input.sections !== undefined) updates.sections = input.sections;
  if (input.buildTime !== undefined) updates.buildTime = input.buildTime;
  if (input.estimatedCost !== undefined) updates.estimatedCost = input.estimatedCost;
  if (input.visibility !== undefined) updates.visibility = input.visibility;

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
  return (await getContentBySlug(db, slug, authorId))!;
}

export async function deleteContent(db: DB, contentId: string, authorId: string): Promise<boolean> {
  const result = await db
    .update(contentItems)
    .set({ status: 'archived', updatedAt: new Date() })
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

  // Upsert tags
  const tagRows = [];
  for (const name of tagNames) {
    const slug = generateSlug(name);
    if (!slug) continue;

    const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);

    if (existing.length > 0) {
      tagRows.push(existing[0]!);
    } else {
      const [newTag] = await db.insert(tags).values({ name, slug }).returning();
      tagRows.push(newTag!);
    }
  }

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
  const existing = await db
    .select()
    .from(contentBuilds)
    .where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(contentBuilds)
      .where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId)));
    await db
      .update(contentItems)
      .set({ buildCount: sql`GREATEST(${contentItems.buildCount} - 1, 0)` })
      .where(eq(contentItems.id, contentId));
    const [updated] = await db
      .select({ buildCount: contentItems.buildCount })
      .from(contentItems)
      .where(eq(contentItems.id, contentId));
    return { marked: false, count: updated?.buildCount ?? 0 };
  }

  await db.insert(contentBuilds).values({ contentId, userId });
  await db
    .update(contentItems)
    .set({ buildCount: sql`${contentItems.buildCount} + 1` })
    .where(eq(contentItems.id, contentId));
  const [updated] = await db
    .select({ buildCount: contentItems.buildCount })
    .from(contentItems)
    .where(eq(contentItems.id, contentId));
  return { marked: true, count: updated?.buildCount ?? 0 };
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
  const slug = await ensureUniqueSlug(db, `${item.slug}-fork-${Date.now()}`);
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

  return (await getContentBySlug(db, forked!.slug, userId))!;
}

// --- Federation Hooks ---
// Called by route handlers after content mutations when federation is enabled

export async function onContentPublished(
  db: DB,
  contentId: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateContent(db, contentId, config.instance.domain).catch((err: unknown) => {
    console.error('[federation]', err);
  });
}

export async function onContentUpdated(
  db: DB,
  contentId: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateUpdate(db, contentId, config.instance.domain).catch((err: unknown) => {
    console.error('[federation]', err);
  });
}

export async function onContentDeleted(
  db: DB,
  contentId: string,
  authorUsername: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateDelete(db, contentId, config.instance.domain, authorUsername).catch(
    (err: unknown) => {
      console.error('[federation]', err);
    },
  );
}
