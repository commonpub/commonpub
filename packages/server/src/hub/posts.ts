import { eq, and, or, desc, sql, inArray, isNull } from 'drizzle-orm';
import { emitHook } from '../hooks.js';
import {
  hubs,
  hubMembers,
  hubPosts,
  hubPostReplies,
  hubPostLikes,
  hubShares,
  contentItems,
  users,
} from '@commonpub/schema';
import type {
  DB,
  HubPostItem,
  HubReplyItem,
  HubPostFilters,
  PostType,
} from '../types.js';
import { hasPermission } from '../utils.js';
import { USER_REF_SELECT, normalizePagination, countRows } from '../query.js';
import { checkBan } from './moderation.js';
import { createNotification } from '../notification/notification.js';

// --- Posts ---

export async function createPost(
  db: DB,
  authorId: string,
  input: { hubId: string; type?: PostType; content: string },
): Promise<HubPostItem> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(
      and(
        eq(hubMembers.hubId, input.hubId),
        eq(hubMembers.userId, authorId),
      ),
    )
    .limit(1);

  if (member.length === 0) {
    throw new Error('Must be a member to post');
  }

  const postResult = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(hubPosts)
      .values({
        hubId: input.hubId,
        authorId,
        type: input.type ?? 'text',
        content: input.content,
      })
      .returning();

    await tx
      .update(hubs)
      .set({ postCount: sql`${hubs.postCount} + 1` })
      .where(eq(hubs.id, input.hubId));

    const author = await tx
      .select(USER_REF_SELECT)
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    const result: HubPostItem = {
      id: post!.id,
      hubId: post!.hubId,
      type: post!.type,
      content: post!.content,
      isPinned: post!.isPinned,
      isLocked: post!.isLocked,
      likeCount: 0,
      replyCount: 0,
      createdAt: post!.createdAt,
      updatedAt: post!.updatedAt,
      author: author[0] ?? { id: authorId, username: 'unknown', displayName: null, avatarUrl: null },
    };

    // Collect data for post-transaction notification
    const hubInfo = await tx.select({ name: hubs.name, slug: hubs.slug }).from(hubs).where(eq(hubs.id, input.hubId)).limit(1);
    const admins = await tx
      .select({ userId: hubMembers.userId })
      .from(hubMembers)
      .where(and(eq(hubMembers.hubId, input.hubId), or(eq(hubMembers.role, 'owner'), eq(hubMembers.role, 'admin'))))
      .limit(10);

    return { ...result, _notify: { hub: hubInfo[0], admins, actorName: author[0]?.displayName || author[0]?.username || 'Someone' } };
  });

  // Fire notifications AFTER transaction (avoids single-connection deadlock)
  const notify = (postResult as HubPostItem & { _notify?: { hub?: { name: string; slug: string }; admins: { userId: string }[]; actorName: string } })._notify;
  if (notify) {
    for (const admin of notify.admins) {
      if (admin.userId !== authorId) {
        createNotification(db, {
          userId: admin.userId,
          type: 'hub',
          title: `New post in ${notify.hub?.name ?? 'hub'}`,
          message: `${notify.actorName} posted in ${notify.hub?.name ?? 'your hub'}`,
          link: notify.hub ? `/hubs/${notify.hub.slug}/posts/${postResult.id}` : undefined,
          actorId: authorId,
        }).catch(() => {});
      }
    }
  }

  // Emit hook for consumer extensions
  await emitHook('hub:post:created', {
    db,
    postId: postResult.id,
    hubId: input.hubId,
    authorId,
    postType: input.type ?? 'text',
  });

  // Return clean HubPostItem without internal _notify data
  const { _notify, ...cleanResult } = postResult as HubPostItem & { _notify?: unknown };
  return cleanResult as HubPostItem;
}

export async function listPosts(
  db: DB,
  hubId: string,
  filters: Omit<HubPostFilters, 'hubId'> = {},
): Promise<{ items: HubPostItem[]; total: number }> {
  const conditions = [eq(hubPosts.hubId, hubId)];

  if (filters.type) {
    conditions.push(eq(hubPosts.type, filters.type));
  }

  const where = and(...conditions);
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db
      .select({
        post: hubPosts,
        author: USER_REF_SELECT,
      })
      .from(hubPosts)
      .innerJoin(users, eq(hubPosts.authorId, users.id))
      .where(where)
      .orderBy(desc(hubPosts.isPinned), desc(hubPosts.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, hubPosts, where),
  ]);

  const items: HubPostItem[] = rows.map((row) => {
    const item: HubPostItem = {
      id: row.post.id,
      hubId: row.post.hubId,
      type: row.post.type,
      content: row.post.content,
      isPinned: row.post.isPinned,
      isLocked: row.post.isLocked,
      likeCount: row.post.likeCount,
      replyCount: row.post.replyCount,
      createdAt: row.post.createdAt,
      updatedAt: row.post.updatedAt,
      author: row.author,
    };

    if (row.post.type === 'share') {
      try {
        item.sharedContent = JSON.parse(row.post.content);
      } catch {
        // Content is not valid JSON, leave as-is
      }
    }

    return item;
  });

  // Backfill missing cover images and authorUsername on share posts (for shares created before enrichment)
  const sharesToEnrich = items.filter(
    (i) => i.type === 'share' && i.sharedContent && (!(i.sharedContent as Record<string, unknown>).coverImageUrl || !(i.sharedContent as Record<string, unknown>).authorUsername) && (i.sharedContent as Record<string, unknown>).contentId,
  );
  if (sharesToEnrich.length > 0) {
    const contentIds = sharesToEnrich.map((i) => (i.sharedContent as Record<string, unknown>).contentId as string);
    const enrichData = await db
      .select({ id: contentItems.id, coverImageUrl: contentItems.coverImageUrl, description: contentItems.description, authorUsername: users.username })
      .from(contentItems)
      .innerJoin(users, eq(contentItems.authorId, users.id))
      .where(inArray(contentItems.id, contentIds));
    const enrichMap = new Map(enrichData.map((e) => [e.id, e]));
    for (const item of sharesToEnrich) {
      const sc = item.sharedContent as Record<string, unknown>;
      const enrich = enrichMap.get(sc.contentId as string);
      if (enrich) {
        if (!sc.coverImageUrl) sc.coverImageUrl = enrich.coverImageUrl;
        if (!sc.description) sc.description = enrich.description;
        if (!sc.authorUsername) sc.authorUsername = enrich.authorUsername;
      }
    }
  }

  return { items, total };
}

export async function deletePost(
  db: DB,
  postId: string,
  userId: string,
  hubId: string,
): Promise<boolean> {
  const post = await db
    .select({ authorId: hubPosts.authorId, hubId: hubPosts.hubId })
    .from(hubPosts)
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (post.length === 0 || post[0]!.hubId !== hubId) return false;

  if (post[0]!.authorId !== userId) {
    const member = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)),
      )
      .limit(1);

    if (member.length === 0 || !hasPermission(member[0]!.role, 'deletePost')) {
      return false;
    }
  }

  await db.delete(hubPosts).where(eq(hubPosts.id, postId));

  await db
    .update(hubs)
    .set({ postCount: sql`GREATEST(${hubs.postCount} - 1, 0)` })
    .where(eq(hubs.id, hubId));

  return true;
}

/**
 * Edit a hub post's content. Only the author can edit, and must not be banned.
 */
export async function editPost(
  db: DB,
  postId: string,
  userId: string,
  hubId: string,
  input: { content: string },
): Promise<HubPostItem | null> {
  const [post] = await db
    .select({ authorId: hubPosts.authorId, hubId: hubPosts.hubId })
    .from(hubPosts)
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (!post || post.hubId !== hubId || post.authorId !== userId) return null;

  // Banned users cannot edit posts
  const ban = await checkBan(db, hubId, userId);
  if (ban) return null;

  await db
    .update(hubPosts)
    .set({ content: input.content, updatedAt: new Date() })
    .where(eq(hubPosts.id, postId));

  return getPostById(db, postId);
}

export async function togglePinPost(
  db: DB,
  postId: string,
  userId: string,
  hubId: string,
): Promise<{ pinned: boolean } | null> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'pinPost')) {
    return null;
  }

  const post = await db
    .select({ isPinned: hubPosts.isPinned })
    .from(hubPosts)
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (post.length === 0) return null;

  const newPinned = !post[0]!.isPinned;
  await db
    .update(hubPosts)
    .set({ isPinned: newPinned, updatedAt: new Date() })
    .where(eq(hubPosts.id, postId));

  return { pinned: newPinned };
}

export async function toggleLockPost(
  db: DB,
  postId: string,
  userId: string,
  hubId: string,
): Promise<{ locked: boolean } | null> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'lockPost')) {
    return null;
  }

  const post = await db
    .select({ isLocked: hubPosts.isLocked })
    .from(hubPosts)
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (post.length === 0) return null;

  const newLocked = !post[0]!.isLocked;
  await db
    .update(hubPosts)
    .set({ isLocked: newLocked, updatedAt: new Date() })
    .where(eq(hubPosts.id, postId));

  return { locked: newLocked };
}

/**
 * Get a single hub post by ID with author info.
 */
export async function getPostById(
  db: DB,
  postId: string,
): Promise<HubPostItem | null> {
  const [row] = await db
    .select({
      post: hubPosts,
      author: USER_REF_SELECT,
    })
    .from(hubPosts)
    .innerJoin(users, eq(hubPosts.authorId, users.id))
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (!row) return null;

  const item: HubPostItem = {
    id: row.post.id,
    hubId: row.post.hubId,
    type: row.post.type,
    content: row.post.content,
    isPinned: row.post.isPinned,
    isLocked: row.post.isLocked,
    likeCount: row.post.likeCount,
    replyCount: row.post.replyCount,
    createdAt: row.post.createdAt,
    updatedAt: row.post.updatedAt,
    author: row.author,
  };

  if (row.post.type === 'share') {
    try {
      item.sharedContent = JSON.parse(row.post.content);
    } catch { /* not JSON */ }
  }

  return item;
}

// --- Likes ---

/**
 * Like a hub post. Returns true if liked, false if already liked.
 */
export async function likePost(
  db: DB,
  userId: string,
  postId: string,
): Promise<boolean> {
  // Use ON CONFLICT to handle concurrent requests atomically
  const result = await db
    .insert(hubPostLikes)
    .values({ postId, userId })
    .onConflictDoNothing({ target: [hubPostLikes.postId, hubPostLikes.userId] })
    .returning({ id: hubPostLikes.id });

  if (result.length === 0) return false; // Already liked

  await db.update(hubPosts).set({ likeCount: sql`${hubPosts.likeCount} + 1` }).where(eq(hubPosts.id, postId));

  // Notify post author (non-critical)
  try {
    const [post] = await db.select({ authorId: hubPosts.authorId, hubId: hubPosts.hubId }).from(hubPosts).where(eq(hubPosts.id, postId)).limit(1);
    if (post && post.authorId !== userId) {
      const [actor] = await db.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
      const [hub] = await db.select({ slug: hubs.slug }).from(hubs).where(eq(hubs.id, post.hubId)).limit(1);
      const actorName = actor?.displayName || actor?.username || 'Someone';
      await createNotification(db, {
        userId: post.authorId,
        type: 'like',
        title: 'New like',
        message: `${actorName} liked your post`,
        link: hub ? `/hubs/${hub.slug}/posts/${postId}` : undefined,
        actorId: userId,
      });
    }
  } catch { /* non-critical */ }

  return true;
}

/**
 * Unlike a hub post. Returns true if unliked, false if wasn't liked.
 */
export async function unlikePost(
  db: DB,
  userId: string,
  postId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: hubPostLikes.id })
    .from(hubPostLikes)
    .where(and(eq(hubPostLikes.postId, postId), eq(hubPostLikes.userId, userId)))
    .limit(1);

  if (existing.length === 0) return false;

  await db.delete(hubPostLikes).where(eq(hubPostLikes.id, existing[0]!.id));
  await db.update(hubPosts).set({ likeCount: sql`GREATEST(${hubPosts.likeCount} - 1, 0)` }).where(eq(hubPosts.id, postId));
  return true;
}

/**
 * Check if a user has liked a hub post.
 */
export async function hasLikedPost(
  db: DB,
  userId: string,
  postId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: hubPostLikes.id })
    .from(hubPostLikes)
    .where(and(eq(hubPostLikes.postId, postId), eq(hubPostLikes.userId, userId)))
    .limit(1);
  return !!row;
}

// --- Replies ---

export async function createReply(
  db: DB,
  authorId: string,
  input: { postId: string; content: string; parentId?: string },
): Promise<HubReplyItem> {
  const post = await db
    .select({ hubId: hubPosts.hubId, isLocked: hubPosts.isLocked })
    .from(hubPosts)
    .where(eq(hubPosts.id, input.postId))
    .limit(1);

  if (post.length === 0) throw new Error('Post not found');
  if (post[0]!.isLocked) throw new Error('Post is locked');

  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(
      and(
        eq(hubMembers.hubId, post[0]!.hubId),
        eq(hubMembers.userId, authorId),
      ),
    )
    .limit(1);

  if (member.length === 0) throw new Error('Must be a member to reply');

  const ban = await checkBan(db, post[0]!.hubId, authorId);
  if (ban) throw new Error('You are banned from this hub');

  const [reply] = await db
    .insert(hubPostReplies)
    .values({
      postId: input.postId,
      authorId,
      content: input.content,
      parentId: input.parentId ?? null,
    })
    .returning();

  await db
    .update(hubPosts)
    .set({ replyCount: sql`${hubPosts.replyCount} + 1` })
    .where(eq(hubPosts.id, input.postId));

  const author = await db
    .select(USER_REF_SELECT)
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  // Notify post author about reply (non-critical)
  try {
    const [postRow] = await db.select({ postAuthorId: hubPosts.authorId, hubId: hubPosts.hubId }).from(hubPosts).where(eq(hubPosts.id, input.postId)).limit(1);
    if (postRow && postRow.postAuthorId !== authorId) {
      const [hub] = await db.select({ slug: hubs.slug }).from(hubs).where(eq(hubs.id, postRow.hubId)).limit(1);
      const actorName = author[0]?.displayName || author[0]?.username || 'Someone';
      await createNotification(db, {
        userId: postRow.postAuthorId,
        type: 'comment',
        title: 'New reply',
        message: `${actorName} replied to your post`,
        link: hub ? `/hubs/${hub.slug}/posts/${input.postId}` : undefined,
        actorId: authorId,
      });
    }
    // Also notify parent reply author if this is a nested reply
    if (input.parentId) {
      const [parentReply] = await db.select({ parentAuthorId: hubPostReplies.authorId }).from(hubPostReplies).where(eq(hubPostReplies.id, input.parentId)).limit(1);
      if (parentReply && parentReply.parentAuthorId !== authorId && parentReply.parentAuthorId !== postRow?.postAuthorId) {
        const [hub] = await db.select({ slug: hubs.slug }).from(hubs).where(eq(hubs.id, post[0]!.hubId)).limit(1);
        const actorName = author[0]?.displayName || author[0]?.username || 'Someone';
        await createNotification(db, {
          userId: parentReply.parentAuthorId,
          type: 'comment',
          title: 'New reply',
          message: `${actorName} replied to your comment`,
          link: hub ? `/hubs/${hub.slug}/posts/${input.postId}` : undefined,
          actorId: authorId,
        });
      }
    }
  } catch { /* non-critical */ }

  return {
    id: reply!.id,
    postId: reply!.postId,
    content: reply!.content,
    likeCount: 0,
    createdAt: reply!.createdAt,
    updatedAt: reply!.updatedAt,
    parentId: reply!.parentId,
    author: author[0]!,
  };
}

export async function listReplies(
  db: DB,
  postId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: HubReplyItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);

  // Fetch root replies with pagination
  const rootWhere = and(eq(hubPostReplies.postId, postId), isNull(hubPostReplies.parentId));

  const [rootRows, total] = await Promise.all([
    db
      .select({ id: hubPostReplies.id })
      .from(hubPostReplies)
      .where(rootWhere)
      .orderBy(desc(hubPostReplies.createdAt))
      .limit(limit)
      .offset(offset),
    countRows(db, hubPostReplies, rootWhere),
  ]);

  if (rootRows.length === 0) return { items: [], total };

  const rootIds = rootRows.map((r) => r.id);

  // Fetch root + children in one query
  const rows = await db
    .select({
      reply: hubPostReplies,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubPostReplies)
    .innerJoin(users, eq(hubPostReplies.authorId, users.id))
    .where(
      and(
        eq(hubPostReplies.postId, postId),
        or(
          and(isNull(hubPostReplies.parentId), inArray(hubPostReplies.id, rootIds)),
          inArray(hubPostReplies.parentId, rootIds),
        ),
      ),
    )
    .orderBy(desc(hubPostReplies.createdAt));

  const replyMap = new Map<string, HubReplyItem>();
  const rootReplies: HubReplyItem[] = [];

  for (const row of rows) {
    const item: HubReplyItem = {
      id: row.reply.id,
      postId: row.reply.postId,
      content: row.reply.content,
      likeCount: row.reply.likeCount,
      createdAt: row.reply.createdAt,
      updatedAt: row.reply.updatedAt,
      parentId: row.reply.parentId,
      author: row.author,
      replies: [],
    };
    replyMap.set(item.id, item);
  }

  // Preserve root ordering
  for (const rootId of rootIds) {
    const item = replyMap.get(rootId);
    if (item) rootReplies.push(item);
  }

  for (const item of replyMap.values()) {
    if (item.parentId && replyMap.has(item.parentId)) {
      replyMap.get(item.parentId)!.replies!.push(item);
    }
  }

  return { items: rootReplies, total };
}

export async function deleteReply(
  db: DB,
  replyId: string,
  userId: string,
  hubId: string,
): Promise<boolean> {
  const reply = await db
    .select({ authorId: hubPostReplies.authorId, postId: hubPostReplies.postId, postHubId: hubPosts.hubId })
    .from(hubPostReplies)
    .innerJoin(hubPosts, eq(hubPostReplies.postId, hubPosts.id))
    .where(eq(hubPostReplies.id, replyId))
    .limit(1);

  if (reply.length === 0 || reply[0]!.postHubId !== hubId) return false;

  if (reply[0]!.authorId !== userId) {
    const member = await db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)),
      )
      .limit(1);

    if (member.length === 0 || !hasPermission(member[0]!.role, 'deletePost')) {
      return false;
    }
  }

  await db.delete(hubPostReplies).where(eq(hubPostReplies.id, replyId));

  await db
    .update(hubPosts)
    .set({ replyCount: sql`GREATEST(${hubPosts.replyCount} - 1, 0)` })
    .where(eq(hubPosts.id, reply[0]!.postId));

  return true;
}

// --- Content Sharing ---

export async function shareContent(
  db: DB,
  userId: string,
  hubId: string,
  contentId: string,
): Promise<HubPostItem | null> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) return null;

  const content = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      slug: contentItems.slug,
      type: contentItems.type,
      coverImageUrl: contentItems.coverImageUrl,
      description: contentItems.description,
      authorUsername: users.username,
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (content.length === 0) return null;

  // Check for duplicate share
  const existing = await db
    .select({ id: hubShares.id })
    .from(hubShares)
    .where(and(eq(hubShares.hubId, hubId), eq(hubShares.contentId, contentId)))
    .limit(1);

  if (existing.length > 0) return null;

  const sharePayload = JSON.stringify({
    contentId: content[0]!.id,
    title: content[0]!.title,
    slug: content[0]!.slug,
    type: content[0]!.type,
    coverImageUrl: content[0]!.coverImageUrl ?? null,
    description: content[0]!.description ?? null,
    authorUsername: content[0]!.authorUsername,
  });

  await db.insert(hubShares).values({
    hubId,
    contentId,
    sharedById: userId,
  });

  return createPost(db, userId, {
    hubId,
    type: 'share',
    content: sharePayload,
  });
}

export async function unshareContent(
  db: DB,
  userId: string,
  hubId: string,
  contentId: string,
): Promise<boolean> {
  const share = await db
    .select({ id: hubShares.id })
    .from(hubShares)
    .where(
      and(
        eq(hubShares.hubId, hubId),
        eq(hubShares.contentId, contentId),
        eq(hubShares.sharedById, userId),
      ),
    )
    .limit(1);

  if (share.length === 0) return false;

  await db.delete(hubShares).where(eq(hubShares.id, share[0]!.id));
  return true;
}

export async function listShares(
  db: DB,
  hubId: string,
): Promise<Array<{ id: string; contentId: string; sharedById: string; createdAt: Date }>> {
  return db
    .select({
      id: hubShares.id,
      contentId: hubShares.contentId,
      sharedById: hubShares.sharedById,
      createdAt: hubShares.createdAt,
    })
    .from(hubShares)
    .where(eq(hubShares.hubId, hubId))
    .orderBy(desc(hubShares.createdAt));
}
