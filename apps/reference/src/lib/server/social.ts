import { eq, and, desc, sql } from 'drizzle-orm';
import { likes, comments, bookmarks, contentItems, users } from '@snaplify/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type DB = NodePgDatabase<Record<string, unknown>>;

export async function toggleLike(
  db: DB,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ liked: boolean }> {
  const existing = await db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.userId, userId),
        eq(likes.targetType, targetType as 'project' | 'article' | 'blog' | 'comment' | 'post'),
        eq(likes.targetId, targetId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(likes).where(eq(likes.id, existing[0]!.id));
    // Decrement denormalized count
    await db
      .update(contentItems)
      .set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` })
      .where(eq(contentItems.id, targetId));
    return { liked: false };
  }

  await db.insert(likes).values({
    userId,
    targetType: targetType as 'project' | 'article' | 'blog' | 'comment' | 'post',
    targetId,
  });
  await db
    .update(contentItems)
    .set({ likeCount: sql`${contentItems.likeCount} + 1` })
    .where(eq(contentItems.id, targetId));
  return { liked: true };
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
        eq(likes.targetType, targetType as 'project' | 'article' | 'blog' | 'comment' | 'post'),
        eq(likes.targetId, targetId),
      ),
    )
    .limit(1);

  return result.length > 0;
}

export interface CommentItem {
  id: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  replies?: CommentItem[];
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
          targetType as 'project' | 'article' | 'blog' | 'post' | 'lesson',
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
      targetType: input.targetType as 'project' | 'article' | 'blog' | 'post' | 'lesson',
      targetId: input.targetId,
      content: input.content,
      parentId: input.parentId ?? null,
    })
    .returning();

  // Update denormalized count
  await db
    .update(contentItems)
    .set({ commentCount: sql`${contentItems.commentCount} + 1` })
    .where(eq(contentItems.id, input.targetId));

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
    .select({ id: comments.id, targetId: comments.targetId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)))
    .limit(1);

  if (existing.length === 0) return false;

  await db.delete(comments).where(eq(comments.id, commentId));

  // Update denormalized count
  await db
    .update(contentItems)
    .set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` })
    .where(eq(contentItems.id, existing[0]!.targetId));

  return true;
}

export async function toggleBookmark(
  db: DB,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ bookmarked: boolean }> {
  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(
          bookmarks.targetType,
          targetType as 'project' | 'article' | 'blog' | 'explainer' | 'learning_path',
        ),
        eq(bookmarks.targetId, targetId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing[0]!.id));
    return { bookmarked: false };
  }

  await db.insert(bookmarks).values({
    userId,
    targetType: targetType as 'project' | 'article' | 'blog' | 'explainer' | 'learning_path',
    targetId,
  });
  return { bookmarked: true };
}
