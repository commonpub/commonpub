import { eq, and, desc, sql } from 'drizzle-orm';
import { contentItems, tags, contentTags, users } from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { generateSlug, ensureUniqueSlug } from '../utils/slug';
import type {
  ContentListItem,
  ContentDetail,
  CreateContentInput,
  UpdateContentInput,
  ContentFilters,
} from '../types';
import { federateContent, federateUpdate, federateDelete } from './federation';
import type { CommonPubConfig } from '@commonpub/config';

type DB = NodePgDatabase<Record<string, unknown>>;

function mapToListItem(
  row: Record<string, unknown>,
  author: Record<string, unknown>,
): ContentListItem {
  const item = row as Record<string, unknown>;
  return {
    id: item.id as string,
    type: item.type as string,
    title: item.title as string,
    slug: item.slug as string,
    description: item.description as string | null,
    coverImageUrl: item.coverImageUrl as string | null,
    status: item.status as string,
    difficulty: item.difficulty as string | null,
    viewCount: item.viewCount as number,
    likeCount: item.likeCount as number,
    commentCount: item.commentCount as number,
    publishedAt: item.publishedAt as Date | null,
    createdAt: item.createdAt as Date,
    author: {
      id: author.id as string,
      username: author.username as string,
      displayName: author.displayName as string | null,
      avatarUrl: author.avatarUrl as string | null,
    },
  };
}

export async function listContent(
  db: DB,
  filters: ContentFilters = {},
): Promise<{ items: ContentListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(contentItems.status, filters.status as 'draft' | 'published' | 'archived'));
  }
  if (filters.type) {
    conditions.push(
      eq(contentItems.type, filters.type as 'project' | 'article' | 'guide' | 'blog' | 'explainer'),
    );
  }
  if (filters.authorId) {
    conditions.push(eq(contentItems.authorId, filters.authorId));
  }
  if (filters.featured) {
    conditions.push(eq(contentItems.isFeatured, true));
  }
  if (filters.difficulty) {
    conditions.push(eq(contentItems.difficulty, filters.difficulty as 'beginner' | 'intermediate' | 'advanced'));
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(
      sql`(${contentItems.title} ILIKE ${searchPattern} OR ${contentItems.description} ILIKE ${searchPattern})`
    );
  }
  if (filters.tag) {
    conditions.push(
      sql`${contentItems.id} IN (
        SELECT ${contentTags.contentId} FROM ${contentTags}
        INNER JOIN ${tags} ON ${tags.id} = ${contentTags.tagId}
        WHERE ${tags.slug} = ${filters.tag}
      )`
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
            : [desc(contentItems.publishedAt), desc(contentItems.createdAt)])
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

  // Fetch tags
  const itemTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, item.id));

  return {
    ...mapToListItem(item, row.author),
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
      type: input.type as 'project' | 'article' | 'guide' | 'blog' | 'explainer',
      title: input.title,
      slug,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      content: input.content ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      category: input.category ?? null,
      difficulty: (input.difficulty as 'beginner' | 'intermediate' | 'advanced') ?? null,
      sections: (input.sections as typeof contentItems.$inferInsert.sections) ?? null,
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
  if (input.content !== undefined) updates.content = input.content;
  if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl;
  if (input.category !== undefined) updates.category = input.category;
  if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
  if (input.seoDescription !== undefined) updates.seoDescription = input.seoDescription;
  if (input.sections !== undefined) updates.sections = input.sections;

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
  return updateContent(db, contentId, authorId, { status: 'published' });
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

// --- Federation Hooks ---
// Called by route handlers after content mutations when federation is enabled

export async function onContentPublished(
  db: DB,
  contentId: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateContent(db, contentId, config.instance.domain).catch((err: unknown) => { console.error('[federation]', err); });
}

export async function onContentUpdated(
  db: DB,
  contentId: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateUpdate(db, contentId, config.instance.domain).catch((err: unknown) => { console.error('[federation]', err); });
}

export async function onContentDeleted(
  db: DB,
  contentId: string,
  authorUsername: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateDelete(db, contentId, config.instance.domain, authorUsername).catch((err: unknown) => { console.error('[federation]', err); });
}
