import { eq, and, or, desc, sql, inArray, isNull } from 'drizzle-orm';
import {
  likes,
  comments,
  bookmarks,
  follows,
  contentItems,
  hubPosts,
  users,
  federatedContent,
  remoteActors,
} from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB, CommentItem } from '../types.js';
import type { LikeTargetType, CommentTargetType } from '@commonpub/schema';
import { federateLike, federateUnlike } from '../federation/federation.js';
import { createNotification } from '../notification/notification.js';
import { USER_REF_SELECT, USER_REF_WITH_BIO_SELECT, normalizePagination, countRows } from '../query.js';

export type { CommentItem };

export async function toggleLike(
  db: DB,
  userId: string,
  targetType: LikeTargetType,
  targetId: string,
): Promise<{ liked: boolean }> {
  const result = await db.transaction(async (tx) => {
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

  // Notify target author on new like (non-critical)
  if (result.liked) {
    try {
      let authorId: string | null = null;
      let title: string | null = null;
      let link: string | undefined;

      if (targetType === 'post') {
        const [t] = await db.select({ authorId: hubPosts.authorId }).from(hubPosts).where(eq(hubPosts.id, targetId)).limit(1);
        if (t) authorId = t.authorId;
      } else if (targetType !== 'comment') {
        // Content types: project, article, blog, explainer
        const [t] = await db.select({ authorId: contentItems.authorId, title: contentItems.title, slug: contentItems.slug, type: contentItems.type }).from(contentItems).where(eq(contentItems.id, targetId)).limit(1);
        if (t) { authorId = t.authorId; title = t.title; link = `/${t.type}/${t.slug}`; }
      }

      if (authorId && authorId !== userId) {
        const [actor] = await db.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
        const name = actor?.displayName || actor?.username || 'Someone';
        await createNotification(db, { userId: authorId, type: 'like', actorId: userId, title: 'New like', message: `${name} liked "${title || 'your content'}"`, link });
      }
    } catch { /* non-critical */ }
  }

  return result;
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

export async function isBookmarked(
  db: DB,
  userId: string,
  targetType: 'project' | 'article' | 'blog' | 'explainer' | 'learning_path',
  targetId: string,
): Promise<boolean> {
  const result = await db
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

  return result.length > 0;
}

export async function listComments(
  db: DB,
  targetType: CommentTargetType,
  targetId: string,
  limit?: number,
  offset?: number,
): Promise<CommentItem[]> {
  const safeLimit = Math.min(limit ?? 20, 100);
  const safeOffset = offset ?? 0;

  // Step 1: Fetch paginated root comment IDs
  const rootRows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
        isNull(comments.parentId),
      ),
    )
    .orderBy(desc(comments.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);

  if (rootRows.length === 0) return [];

  const rootIds = rootRows.map((r) => r.id);

  // Step 2: Fetch root comments + all their direct children in one query
  const rows = await db
    .select({
      comment: comments,
      author: USER_REF_SELECT,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(
      and(
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
        or(
          and(isNull(comments.parentId), inArray(comments.id, rootIds)),
          inArray(comments.parentId, rootIds),
        ),
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

  // Preserve root ordering from the paginated query
  for (const rootId of rootIds) {
    const item = commentMap.get(rootId);
    if (item) rootComments.push(item);
  }

  for (const item of commentMap.values()) {
    if (item.parentId && commentMap.has(item.parentId)) {
      commentMap.get(item.parentId)!.replies!.push(item);
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
    .select(USER_REF_SELECT)
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  // Resolve target for notifications
  let targetAuthorId: string | null = null;
  let targetTitle: string | null = null;
  let link: string | undefined;

  // Notify target author on new comment (non-critical)
  try {

    if (input.targetType === 'post') {
      const [t] = await db.select({ authorId: hubPosts.authorId }).from(hubPosts).where(eq(hubPosts.id, input.targetId)).limit(1);
      if (t) targetAuthorId = t.authorId;
    } else {
      // Content types: project, article, blog, explainer, lesson
      const [t] = await db.select({ authorId: contentItems.authorId, title: contentItems.title, slug: contentItems.slug, type: contentItems.type }).from(contentItems).where(eq(contentItems.id, input.targetId)).limit(1);
      if (t) { targetAuthorId = t.authorId; targetTitle = t.title; link = `/${t.type}/${t.slug}`; }
    }

    if (targetAuthorId && targetAuthorId !== authorId) {
      const actorName = author[0]?.displayName || author[0]?.username || 'Someone';
      await createNotification(db, { userId: targetAuthorId, type: 'comment', actorId: authorId, title: 'New comment', message: `${actorName} commented on "${targetTitle || 'your content'}"`, link });
    }
  } catch { /* non-critical */ }

  // Notify @mentioned users (non-critical)
  try {
    const { extractMentions, resolveUsernames } = await import('./mentions.js');
    const mentioned = extractMentions(input.content);
    if (mentioned.length > 0) {
      const usernameMap = await resolveUsernames(db, mentioned);
      const actorName = author[0]?.displayName || author[0]?.username || 'Someone';
      for (const [, mentionedUserId] of usernameMap) {
        if (mentionedUserId === authorId) continue;
        if (mentionedUserId === targetAuthorId) continue;
        await createNotification(db, {
          userId: mentionedUserId,
          type: 'mention',
          actorId: authorId,
          title: 'You were mentioned',
          message: `${actorName} mentioned you in a comment`,
          link,
        });
      }
    }
  } catch { /* non-critical */ }

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

  // Count child replies that will be cascade-deleted
  const childCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.parentId, commentId));
  const totalDeleted = 1 + (childCount[0]?.count ?? 0);

  // Delete the comment (child replies with parentId pointing here become orphaned,
  // so delete them explicitly)
  await db.delete(comments).where(eq(comments.parentId, commentId));
  await db.delete(comments).where(eq(comments.id, commentId));

  // Update denormalized count (subtract parent + all children)
  if (existing[0]!.targetType === 'post') {
    await db
      .update(hubPosts)
      .set({ replyCount: sql`GREATEST(${hubPosts.replyCount} - ${totalDeleted}, 0)` })
      .where(eq(hubPosts.id, existing[0]!.targetId));
  } else {
    await db
      .update(contentItems)
      .set({ commentCount: sql`GREATEST(${contentItems.commentCount} - ${totalDeleted}, 0)` })
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
  isFederated: boolean;
  content: {
    id: string;
    title: string;
    slug: string;
    type: string;
    coverImageUrl: string | null;
    originDomain?: string | null;
    author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  } | null;
}

export async function listUserBookmarks(
  db: DB,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: BookmarkItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);

  const where = eq(bookmarks.userId, userId);

  const [rows, total] = await Promise.all([
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
        fedContent: {
          id: federatedContent.id,
          title: federatedContent.title,
          cpubType: federatedContent.cpubType,
          coverImageUrl: federatedContent.coverImageUrl,
          originDomain: federatedContent.originDomain,
        },
        fedActor: {
          actorUri: remoteActors.actorUri,
          preferredUsername: remoteActors.preferredUsername,
          displayName: remoteActors.displayName,
          avatarUrl: remoteActors.avatarUrl,
        },
      })
      .from(bookmarks)
      .leftJoin(contentItems, eq(bookmarks.targetId, contentItems.id))
      .leftJoin(users, eq(contentItems.authorId, users.id))
      .leftJoin(federatedContent, eq(bookmarks.targetId, federatedContent.id))
      .leftJoin(remoteActors, eq(federatedContent.remoteActorId, remoteActors.id))
      .where(where)
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, bookmarks, where),
  ]);

  const items: BookmarkItem[] = rows.map((row) => {
    // Local content match
    if (row.content?.id) {
      return {
        id: row.bookmark.id,
        targetType: row.bookmark.targetType,
        targetId: row.bookmark.targetId,
        createdAt: row.bookmark.createdAt,
        isFederated: false,
        content: {
          id: row.content.id,
          title: row.content.title,
          slug: row.content.slug,
          type: row.content.type,
          coverImageUrl: row.content.coverImageUrl,
          author: row.author ?? { id: 'deleted', username: 'deleted', displayName: '[Deleted User]', avatarUrl: null },
        },
      };
    }
    // Federated content match
    if (row.fedContent?.id) {
      return {
        id: row.bookmark.id,
        targetType: row.bookmark.targetType,
        targetId: row.bookmark.targetId,
        createdAt: row.bookmark.createdAt,
        isFederated: true,
        content: {
          id: row.fedContent.id,
          title: row.fedContent.title ?? 'Untitled',
          slug: `mirror/${row.fedContent.id}`,
          type: row.fedContent.cpubType ?? row.bookmark.targetType,
          coverImageUrl: row.fedContent.coverImageUrl,
          originDomain: row.fedContent.originDomain,
          author: row.fedActor?.actorUri
            ? { id: '', username: row.fedActor.preferredUsername ?? 'unknown', displayName: row.fedActor.displayName, avatarUrl: row.fedActor.avatarUrl }
            : { id: 'remote', username: 'remote', displayName: 'Remote Author', avatarUrl: null },
        },
      };
    }
    // Neither matched — deleted content
    return {
      id: row.bookmark.id,
      targetType: row.bookmark.targetType,
      targetId: row.bookmark.targetId,
      createdAt: row.bookmark.createdAt,
      isFederated: false,
      content: null,
    };
  });

  return { items, total };
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

export async function onContentUnliked(
  db: DB,
  userId: string,
  contentUri: string,
  config: CommonPubConfig,
): Promise<void> {
  if (!config.features.federation) return;
  await federateUnlike(db, userId, contentUri, config.instance.domain).catch((err: unknown) => {
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

  // Notify followed user (non-critical)
  if (result) {
    try {
      const [actor] = await db.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, followerId)).limit(1);
      const name = actor?.displayName || actor?.username || 'Someone';
      await createNotification(db, { userId: followingId, type: 'follow', actorId: followerId, title: 'New follower', message: `${name} started following you`, link: `/u/${actor?.username}` });
    } catch { /* non-critical */ }
  }

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
  const { limit, offset } = normalizePagination(opts);

  const where = eq(follows.followingId, userId);

  const [rows, total] = await Promise.all([
    db
      .select({
        user: USER_REF_WITH_BIO_SELECT,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(where)
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, follows, where),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.user,
      bio: row.user.bio ?? null,
      followedAt: row.followedAt,
    })),
    total,
  };
}

export async function listFollowing(
  db: DB,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: FollowUserItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);

  const where = eq(follows.followerId, userId);

  const [rows, total] = await Promise.all([
    db
      .select({
        user: USER_REF_WITH_BIO_SELECT,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(where)
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, follows, where),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.user,
      bio: row.user.bio ?? null,
      followedAt: row.followedAt,
    })),
    total,
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
