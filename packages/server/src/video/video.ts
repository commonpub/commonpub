import { eq, and, desc, sql } from 'drizzle-orm';
import { videos, videoCategories, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';

import type { VideoPlatform } from '@commonpub/schema';

export interface VideoListItem {
  id: string;
  title: string;
  url: string;
  embedUrl: string | null;
  platform: VideoPlatform;
  thumbnailUrl: string | null;
  duration: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  authorId: string;
  authorName: string | null;
  authorUsername: string;
  authorAvatarUrl: string | null;
  createdAt: Date;
}

export interface VideoDetail extends VideoListItem {
  description: string | null;
}

export interface VideoFilters {
  categoryId?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

export interface VideoCategoryItem {
  id: string;
  name: string;
  slug: string;
}

export async function listVideos(
  db: DB,
  filters: VideoFilters = {},
): Promise<{ items: VideoListItem[]; total: number }> {
  const conditions = [];

  if (filters.authorId) {
    conditions.push(eq(videos.authorId, filters.authorId));
  }
  if (filters.categoryId) {
    conditions.push(eq(videos.categoryId, filters.categoryId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select({
        video: videos,
        authorName: users.displayName,
        authorUsername: users.username,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(videos)
      .innerJoin(users, eq(videos.authorId, users.id))
      .where(where)
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, videos, where),
  ]);

  const items: VideoListItem[] = rows.map((row) => ({
    id: row.video.id,
    title: row.video.title,
    url: row.video.url,
    embedUrl: row.video.embedUrl,
    platform: row.video.platform,
    thumbnailUrl: row.video.thumbnailUrl,
    duration: row.video.duration,
    viewCount: row.video.viewCount,
    likeCount: row.video.likeCount,
    commentCount: row.video.commentCount,
    authorId: row.video.authorId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl,
    createdAt: row.video.createdAt,
  }));

  return { items, total };
}

export async function getVideoById(
  db: DB,
  id: string,
): Promise<VideoDetail | null> {
  const rows = await db
    .select({
      video: videos,
      authorName: users.displayName,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(videos)
    .innerJoin(users, eq(videos.authorId, users.id))
    .where(eq(videos.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  return {
    id: row.video.id,
    title: row.video.title,
    url: row.video.url,
    embedUrl: row.video.embedUrl,
    platform: row.video.platform,
    thumbnailUrl: row.video.thumbnailUrl,
    duration: row.video.duration,
    viewCount: row.video.viewCount,
    likeCount: row.video.likeCount,
    commentCount: row.video.commentCount,
    authorId: row.video.authorId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl,
    createdAt: row.video.createdAt,
    description: row.video.description,
  };
}

export async function createVideo(
  db: DB,
  input: {
    title: string;
    url: string;
    description?: string;
    embedUrl?: string;
    platform?: 'youtube' | 'vimeo' | 'other';
    thumbnailUrl?: string;
    duration?: string;
    authorId: string;
    categoryId?: string;
  },
): Promise<VideoDetail> {
  const [row] = await db
    .insert(videos)
    .values({
      title: input.title,
      url: input.url,
      description: input.description ?? null,
      embedUrl: input.embedUrl ?? null,
      platform: (input.platform ?? 'youtube') as typeof videos.platform.enumValues[number],
      thumbnailUrl: input.thumbnailUrl ?? null,
      duration: input.duration ?? null,
      authorId: input.authorId,
      categoryId: input.categoryId ?? null,
    } satisfies typeof videos.$inferInsert)
    .returning();

  // Fetch with author info
  return (await getVideoById(db, row!.id))!;
}

export async function listVideoCategories(db: DB): Promise<VideoCategoryItem[]> {
  const rows = await db
    .select({
      id: videoCategories.id,
      name: videoCategories.name,
      slug: videoCategories.slug,
    })
    .from(videoCategories)
    .orderBy(videoCategories.sortOrder);

  return rows;
}

export async function createVideoCategory(
  db: DB,
  input: { name: string; description?: string; sortOrder?: number },
): Promise<VideoCategoryItem> {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const [row] = await db
    .insert(videoCategories)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();

  return { id: row!.id, name: row!.name, slug: row!.slug };
}

export async function updateVideoCategory(
  db: DB,
  id: string,
  input: { name?: string; description?: string; sortOrder?: number },
): Promise<VideoCategoryItem | null> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  if (Object.keys(updates).length === 0) return null;

  const [row] = await db
    .update(videoCategories)
    .set(updates)
    .where(eq(videoCategories.id, id))
    .returning();

  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug };
}

export async function deleteVideoCategory(db: DB, id: string): Promise<boolean> {
  const result = await db
    .delete(videoCategories)
    .where(eq(videoCategories.id, id))
    .returning({ id: videoCategories.id });

  return result.length > 0;
}

export async function incrementVideoViewCount(db: DB, id: string): Promise<void> {
  await db
    .update(videos)
    .set({ viewCount: sql`${videos.viewCount} + 1` })
    .where(eq(videos.id, id));
}
