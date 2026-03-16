import { eq, desc, sql } from 'drizzle-orm';
import { videos, videoCategories, users } from '@commonpub/schema';
import type { DB } from './types.js';

export interface VideoListItem {
  id: string;
  title: string;
  url: string;
  embedUrl: string | null;
  platform: string;
  thumbnailUrl: string | null;
  duration: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  authorId: string;
  authorName: string | null;
  authorUsername: string;
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

  const where = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        video: videos,
        authorName: users.displayName,
        authorUsername: users.username,
      })
      .from(videos)
      .innerJoin(users, eq(videos.authorId, users.id))
      .where(where)
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(videos)
      .where(where),
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
    createdAt: row.video.createdAt,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
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
    platform?: string;
    thumbnailUrl?: string;
    duration?: string;
    authorId: string;
  },
): Promise<VideoDetail> {
  const [row] = await db
    .insert(videos)
    .values({
      title: input.title,
      url: input.url,
      description: input.description ?? null,
      embedUrl: input.embedUrl ?? null,
      platform: (input.platform ?? 'youtube') as 'youtube' | 'vimeo' | 'other',
      thumbnailUrl: input.thumbnailUrl ?? null,
      duration: input.duration ?? null,
      authorId: input.authorId,
    })
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

export async function incrementVideoViewCount(db: DB, id: string): Promise<void> {
  await db
    .update(videos)
    .set({ viewCount: sql`${videos.viewCount} + 1` })
    .where(eq(videos.id, id));
}
