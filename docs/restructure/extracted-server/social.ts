import { eq, and, desc, sql } from 'drizzle-orm';
import {
  likes,
  comments,
  bookmarks,
  contentItems,
  communityPosts,
  communityPostReplies,
  users,
} from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { CommentItem } from '../types';
import type { CommonPubConfig } from '@commonpub/config';
import { federateLike } from './federation';

type DB = NodePgDatabase<Record<string, unknown>>;

export type { CommentItem };

export async function toggleLike(
  db: DB,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ liked: boolean }> {
  const typedTargetType = targetType as
    | 'project'
    | 'article'
    | 'blog'
    | 'explainer'
    | 'comment'
    | 'post'
    | 'guide';

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(eq(likes.userId, userId), eq(likes.targetType, typedTargetType), eq(likes.targetId, targetId)),
      )
      .limit(1);

    if (existing.length > 0) {
      await tx.delete(likes).where(eq(likes.id, existing[0]!.id));
      await updateLikeCount(tx, targetType, targetId, -1);
      return { liked: false };
    }

    await tx.insert(likes).values({ userId, targetType: typedTargetType, targetId });
    await updateLikeCount(tx, targetType, targetId, 1);
    return { liked: true };
  });
}

async function updateLikeCount(tx: DB, targetType: string, targetId: string, delta: number): Promise<void> {
  switch (targetType) {
    case 'comment':
      await tx
        .update(comments)
        .set({ likeCount: delta > 0 ? sql`${comments.likeCount} + 1` : sql`GREATEST(${comments.likeCount} - 1, 0)` })
        .where(eq(comments.id, targetId));
      break;
    case 'post':
      await tx
        .update(communityPosts)
        .set({ likeCount: delta > 0 ? sql`${communityPosts.likeCount} + 1` : sql`GREATEST(${communityPosts.likeCount} - 1, 0)` })
        .where(eq(communityPosts.id, targetId));
      break;
    default:
      await tx
        .update(contentItems)
        .set({ likeCount: delta > 0 ? sql`${contentItems.likeCount} + 1` : sql`GREATEST(${contentItems.likeCount} - 1, 0)` })
        .where(eq(contentItems.id, targetId));
      break;
  }
}

export async function isLiked(
  db: DB,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const result = await db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.userId, userId),
        eq(
          likes.targetType,
          targetType as 'project' | 'article' | 'blog' | 'explainer' | 'comment' | 'post',
        ),
        eq(likes.targetId, targetId),
      ),
    )
    .limit(1);

  return result.length > 0;
}

export async function listComments(
  db: DB,
  targetType: string,
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
        eq(
          comments.targetType,
          targetType as 'project' | 'article' | 'blog' | 'explainer' | 'post' | 'lesson',
        ),
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
    targetType: string;
    targetId: string;
    content: string;
    parentId?: string;
  },
): Promise<CommentItem> {
  const [row] = await db
    .insert(comments)
    .values({
      authorId,
      targetType: input.targetType as
        | 'project'
        | 'article'
        | 'blog'
        | 'explainer'
        | 'post'
        | 'lesson',
      targetId: input.targetId,
      content: input.content,
      parentId: input.parentId ?? null,
    })
    .returning();

  // Update denormalized count — route to correct table
  if (input.targetType === 'post') {
    await db
      .update(communityPosts)
      .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
      .where(eq(communityPosts.id, input.targetId));
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

export async function deleteComment(db: DB, commentId: string, authorId: string): Promise<boolean> {
  const existing = await db
    .select({ id: comments.id, targetId: comments.targetId, targetType: comments.targetType })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)))
    .limit(1);

  if (existing.length === 0) return false;

  await db.delete(comments).where(eq(comments.id, commentId));

  // Update denormalized count — route to correct table
  if (existing[0]!.targetType === 'post') {
    await db
      .update(communityPosts)
      .set({ replyCount: sql`GREATEST(${communityPosts.replyCount} - 1, 0)` })
      .where(eq(communityPosts.id, existing[0]!.targetId));
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
  targetType: string,
  targetId: string,
): Promise<{ bookmarked: boolean }> {
  const typedTargetType = targetType as 'project' | 'article' | 'blog' | 'explainer' | 'learning_path';

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), eq(bookmarks.targetType, typedTargetType), eq(bookmarks.targetId, targetId)),
      )
      .limit(1);

    if (existing.length > 0) {
      await tx.delete(bookmarks).where(eq(bookmarks.id, existing[0]!.id));
      return { bookmarked: false };
    }

    await tx.insert(bookmarks).values({ userId, targetType: typedTargetType, targetId });
    return { bookmarked: true };
  });
}

// --- Federation Hook ---

export async function onContentLiked(
  db: DB,
  userId: string,
  contentUri: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateLike(db, userId, contentUri, config.instance.domain).catch((err: unknown) => { console.error('[federation]', err); });
}
