import { eq, and, desc, sql } from 'drizzle-orm';
import {
  likes,
  comments,
  bookmarks,
  follows,
  contentItems,
  hubPosts,
  users,
} from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB, CommentItem } from './types.js';
import type { LikeTargetType, CommentTargetType } from '@commonpub/schema';
import { federateLike } from './federation.js';

export type { CommentItem };

export async function toggleLike(
  db: DB,
  userId: string,
  targetType: LikeTargetType,
  targetId: string,
): Promise<{ liked: boolean }> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(
          eq(likes.userId, userId),
          eq(likes.targetType, targetType),
          eq(likes.targetId, targetId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await tx.delete(likes).where(eq(likes.id, existing[0]!.id));
      await updateLikeCount(tx, targetType, targetId, -1);
      return { liked: false };
    }

    await tx.insert(likes).values({ userId, targetType, targetId });
    await updateLikeCount(tx, targetType, targetId, 1);
    return { liked: true };
  });
}

async function updateLikeCount(
  tx: DB,
  targetType: string,
  targetId: string,
  delta: number,
): Promise<void> {
  switch (targetType) {
    case 'comment':
      await tx
        .update(comments)
        .set({
          likeCount:
            delta > 0
              ? sql`${comments.likeCount} + 1`
              : sql`GREATEST(${comments.likeCount} - 1, 0)`,
        })
        .where(eq(comments.id, targetId));
      break;
    case 'post':
      await tx
        .update(hubPosts)
        .set({
          likeCount:
            delta > 0
              ? sql`${hubPosts.likeCount} + 1`
              : sql`GREATEST(${hubPosts.likeCount} - 1, 0)`,
        })
        .where(eq(hubPosts.id, targetId));
      break;
    default:
      await tx
        .update(contentItems)
        .set({
          likeCount:
            delta > 0
              ? sql`${contentItems.likeCount} + 1`
              : sql`GREATEST(${contentItems.likeCount} - 1, 0)`,
        })
        .where(eq(contentItems.id, targetId));
      break;
  }
}

export async function isLiked(
  db: DB,
  userId: string,
  targetType: LikeTargetType,
  targetId: string,
): Promise<boolean> {
  const result = await db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.userId, userId),
        eq(likes.targetType, targetType),
        eq(likes.targetId, targetId),
      ),
    )
    .limit(1);

  return result.length > 0;
}

export async function listComments(
  db: DB,
  targetType: CommentTargetType,
  targetId: string,
): Promise<CommentItem[]> {
  const rows = await db
    .select({
      comment: comments,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(
      and(
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
      ),
    )
    .orderBy(desc(comments.createdAt));

  // Build threaded structure
  const commentMap = new Map<string, CommentItem>();
  const rootComments: CommentItem[] = [];

  for (const row of rows) {
    const item: CommentItem = {
      id: row.comment.id,
      content: row.comment.content,
      likeCount: row.comment.likeCount,
      createdAt: row.comment.createdAt,
      updatedAt: row.comment.updatedAt,
      parentId: row.comment.parentId,
      author: row.author,
      replies: [],
    };
    commentMap.set(item.id, item);
  }

  for (const item of commentMap.values()) {
    if (item.parentId && commentMap.has(item.parentId)) {
      commentMap.get(item.parentId)!.replies!.push(item);
    } else {
      rootComments.push(item);
    }
  }

  return rootComments;
}

export async function createComment(
  db: DB,
  authorId: string,
  input: {
    targetType: CommentTargetType;
    targetId: string;
    content: string;
    parentId?: string;
  },
): Promise<CommentItem> {
  const [row] = await db
    .insert(comments)
    .values({
      authorId,
      targetType: input.targetType,
      targetId: input.targetId,
      content: input.content,
      parentId: input.parentId ?? null,
    })
    .returning();

  // Update denormalized count
  if (input.targetType === 'post') {
    await db
      .update(hubPosts)
      .set({ replyCount: sql`${hubPosts.replyCount} + 1` })
      .where(eq(hubPosts.id, input.targetId));
  } else {
    await db
      .update(contentItems)
      .set({ commentCount: sql`${contentItems.commentCount} + 1` })
      .where(eq(contentItems.id, input.targetId));
  }

  const author = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  return {
    id: row!.id,
    content: row!.content,
    likeCount: 0,
    createdAt: row!.createdAt,
    updatedAt: row!.updatedAt,
    parentId: row!.parentId,
    author: author[0]!,
  };
}

export async function deleteComment(
  db: DB,
  commentId: string,
  authorId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: comments.id, targetId: comments.targetId, targetType: comments.targetType })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)))
    .limit(1);

  if (existing.length === 0) return false;

  await db.delete(comments).where(eq(comments.id, commentId));

  // Update denormalized count
  if (existing[0]!.targetType === 'post') {
    await db
      .update(hubPosts)
      .set({ replyCount: sql`GREATEST(${hubPosts.replyCount} - 1, 0)` })
      .where(eq(hubPosts.id, existing[0]!.targetId));
  } else {
    await db
      .update(contentItems)
      .set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` })
      .where(eq(contentItems.id, existing[0]!.targetId));
  }

  return true;
}

export async function toggleBookmark(
  db: DB,
  userId: string,
  targetType: 'project' | 'article' | 'blog' | 'explainer' | 'learning_path',
  targetId: string,
): Promise<{ bookmarked: boolean }> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.targetType, targetType),
          eq(bookmarks.targetId, targetId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await tx.delete(bookmarks).where(eq(bookmarks.id, existing[0]!.id));
      return { bookmarked: false };
    }

    await tx.insert(bookmarks).values({ userId, targetType, targetId });
    return { bookmarked: true };
  });
}

// --- Bookmark Listing ---

export interface BookmarkItem {
  id: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  content: {
    id: string;
    title: string;
    slug: string;
    type: string;
    coverImageUrl: string | null;
    author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  } | null;
}

export async function listUserBookmarks(
  db: DB,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: BookmarkItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const where = eq(bookmarks.userId, userId);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        bookmark: bookmarks,
        content: {
          id: contentItems.id,
          title: contentItems.title,
          slug: contentItems.slug,
          type: contentItems.type,
          coverImageUrl: contentItems.coverImageUrl,
        },
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(bookmarks)
      .leftJoin(contentItems, eq(bookmarks.targetId, contentItems.id))
      .leftJoin(users, eq(contentItems.authorId, users.id))
      .where(where)
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookmarks)
      .where(where),
  ]);

  const items: BookmarkItem[] = rows.map((row) => ({
    id: row.bookmark.id,
    targetType: row.bookmark.targetType,
    targetId: row.bookmark.targetId,
    createdAt: row.bookmark.createdAt,
    content: row.content?.id
      ? {
          id: row.content.id,
          title: row.content.title,
          slug: row.content.slug,
          type: row.content.type,
          coverImageUrl: row.content.coverImageUrl,
          author: row.author ?? { id: '', username: '', displayName: null, avatarUrl: null },
        }
      : null,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

// --- Federation Hook ---

export async function onContentLiked(
  db: DB,
  userId: string,
  contentUri: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateLike(db, userId, contentUri, config.instance.domain).catch((err: unknown) => {
    console.error('[federation]', err);
  });
}

// --- Follow System ---

export async function followUser(
  db: DB,
  followerId: string,
  followingId: string,
): Promise<{ followed: boolean }> {
  if (followerId === followingId) return { followed: false };

  const [result] = await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing()
    .returning();

  return { followed: !!result };
}

export async function unfollowUser(
  db: DB,
  followerId: string,
  followingId: string,
): Promise<{ unfollowed: boolean }> {
  const result = await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .returning({ id: follows.id });
  return { unfollowed: result.length > 0 };
}

export async function isFollowing(
  db: DB,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return rows.length > 0;
}

export interface FollowUserItem {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followedAt: Date;
}

export async function listFollowers(
  db: DB,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: FollowUserItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const where = eq(follows.followingId, userId);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
        },
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(where)
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.user,
      bio: row.user.bio ?? null,
      followedAt: row.followedAt,
    })),
    total: countResult[0]?.count ?? 0,
  };
}

export async function listFollowing(
  db: DB,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: FollowUserItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  const where = eq(follows.followerId, userId);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
        },
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(where)
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.user,
      bio: row.user.bio ?? null,
      followedAt: row.followedAt,
    })),
    total: countResult[0]?.count ?? 0,
  };
}

// --- Reports ---

export async function createReport(
  db: DB,
  reporterId: string,
  input: {
    targetType: 'project' | 'article' | 'blog' | 'post' | 'comment' | 'user' | 'explainer';
    targetId: string;
    reason: 'spam' | 'harassment' | 'inappropriate' | 'copyright' | 'other';
    description?: string;
  },
): Promise<{ id: string }> {
  const { reports } = await import('@commonpub/schema');

  const [report] = await db
    .insert(reports)
    .values({
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      description: input.description ?? null,
    })
    .returning({ id: reports.id });

  return { id: report!.id };
}
