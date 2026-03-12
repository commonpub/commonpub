import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import {
  communities,
  communityMembers,
  communityPosts,
  communityPostReplies,
  communityBans,
  communityInvites,
  communityShares,
  contentItems,
  users,
} from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { generateSlug, ensureUniqueCommunitySlug } from '../utils/slug';
import { canManageRole, hasPermission } from '../utils/community-permissions';
import type {
  CommunityListItem,
  CommunityDetail,
  CommunityMemberItem,
  CommunityPostItem,
  CommunityReplyItem,
  CommunityFilters,
  CommunityPostFilters,
  CommunityInviteItem,
  CommunityBanItem,
} from '../types';

type DB = NodePgDatabase<Record<string, unknown>>;

// --- Community CRUD ---

export async function listCommunities(
  db: DB,
  filters: CommunityFilters = {},
): Promise<{ items: CommunityListItem[]; total: number }> {
  const conditions = [];

  if (filters.search) {
    conditions.push(ilike(communities.name, `%${filters.search}%`));
  }
  if (filters.joinPolicy) {
    conditions.push(
      eq(communities.joinPolicy, filters.joinPolicy as 'open' | 'approval' | 'invite'),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        community: communities,
        createdBy: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(communities)
      .innerJoin(users, eq(communities.createdById, users.id))
      .where(where)
      .orderBy(desc(communities.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(communities)
      .where(where),
  ]);

  const items: CommunityListItem[] = rows.map((row) => ({
    id: row.community.id,
    name: row.community.name,
    slug: row.community.slug,
    description: row.community.description,
    iconUrl: row.community.iconUrl,
    bannerUrl: row.community.bannerUrl,
    joinPolicy: row.community.joinPolicy,
    isOfficial: row.community.isOfficial,
    memberCount: row.community.memberCount,
    postCount: row.community.postCount,
    createdAt: row.community.createdAt,
    createdBy: row.createdBy,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getCommunityBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
): Promise<CommunityDetail | null> {
  const rows = await db
    .select({
      community: communities,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communities)
    .innerJoin(users, eq(communities.createdById, users.id))
    .where(eq(communities.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  let currentUserRole: string | null = null;
  let isBanned = false;

  if (requesterId) {
    const [memberRows, banResult] = await Promise.all([
      db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, row.community.id),
            eq(communityMembers.userId, requesterId),
          ),
        )
        .limit(1),
      checkBan(db, row.community.id, requesterId),
    ]);

    currentUserRole = memberRows[0]?.role ?? null;
    isBanned = banResult !== null;
  }

  return {
    id: row.community.id,
    name: row.community.name,
    slug: row.community.slug,
    description: row.community.description,
    iconUrl: row.community.iconUrl,
    bannerUrl: row.community.bannerUrl,
    joinPolicy: row.community.joinPolicy,
    isOfficial: row.community.isOfficial,
    memberCount: row.community.memberCount,
    postCount: row.community.postCount,
    createdAt: row.community.createdAt,
    createdBy: row.createdBy,
    rules: row.community.rules,
    updatedAt: row.community.updatedAt,
    currentUserRole,
    isBanned,
  };
}

export async function createCommunity(
  db: DB,
  userId: string,
  input: { name: string; description?: string; rules?: string; joinPolicy?: string },
): Promise<CommunityDetail> {
  const slug = await ensureUniqueCommunitySlug(db, generateSlug(input.name));

  const [community] = await db
    .insert(communities)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      rules: input.rules ?? null,
      joinPolicy: (input.joinPolicy as 'open' | 'approval' | 'invite') ?? 'open',
      createdById: userId,
      memberCount: 1,
    })
    .returning();

  // Auto-add creator as owner
  await db.insert(communityMembers).values({
    communityId: community!.id,
    userId,
    role: 'owner',
  });

  return (await getCommunityBySlug(db, community!.slug, userId))!;
}

export async function updateCommunity(
  db: DB,
  communityId: string,
  userId: string,
  input: {
    name?: string;
    description?: string;
    rules?: string;
    joinPolicy?: string;
    iconUrl?: string;
    bannerUrl?: string;
  },
): Promise<CommunityDetail | null> {
  // Permission check: must be admin+
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'editCommunity')) {
    return null;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = await ensureUniqueCommunitySlug(db, generateSlug(input.name), communityId);
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.rules !== undefined) updates.rules = input.rules;
  if (input.joinPolicy !== undefined) updates.joinPolicy = input.joinPolicy;
  if (input.iconUrl !== undefined) updates.iconUrl = input.iconUrl;
  if (input.bannerUrl !== undefined) updates.bannerUrl = input.bannerUrl;

  await db.update(communities).set(updates).where(eq(communities.id, communityId));

  const slug = (updates.slug as string) ?? undefined;
  if (slug) {
    return getCommunityBySlug(db, slug, userId);
  }

  // Fetch updated community
  const community = await db
    .select({ slug: communities.slug })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  return getCommunityBySlug(db, community[0]!.slug, userId);
}

export async function deleteCommunity(
  db: DB,
  communityId: string,
  userId: string,
): Promise<boolean> {
  // Owner only
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || member[0]!.role !== 'owner') {
    return false;
  }

  await db.delete(communities).where(eq(communities.id, communityId));
  return true;
}

// --- Membership ---

export async function joinCommunity(
  db: DB,
  userId: string,
  communityId: string,
  inviteToken?: string,
): Promise<{ joined: boolean; error?: string }> {
  // Check ban
  const ban = await checkBan(db, communityId, userId);
  if (ban) {
    return { joined: false, error: 'You are banned from this community' };
  }

  // Check join policy (outside transaction — read-only)
  const community = await db
    .select({ joinPolicy: communities.joinPolicy })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (community.length === 0) {
    return { joined: false, error: 'Community not found' };
  }

  const policy = community[0]!.joinPolicy;

  if (policy !== 'open') {
    if (!inviteToken) {
      return { joined: false, error: 'Invite token required' };
    }
    const tokenResult = await validateAndUseInvite(db, inviteToken);
    if (!tokenResult.valid) {
      return { joined: false, error: 'Invalid or expired invite token' };
    }
  }

  return db.transaction(async (tx) => {
    // Use ON CONFLICT DO NOTHING to handle concurrent inserts
    const inserted = await tx
      .insert(communityMembers)
      .values({ communityId, userId, role: 'member' })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      // Already a member (concurrent insert or existing)
      return { joined: true };
    }

    await tx
      .update(communities)
      .set({ memberCount: sql`${communities.memberCount} + 1` })
      .where(eq(communities.id, communityId));

    return { joined: true };
  });
}

export async function leaveCommunity(
  db: DB,
  userId: string,
  communityId: string,
): Promise<{ left: boolean; error?: string }> {
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) {
    return { left: false, error: 'Not a member' };
  }

  if (member[0]!.role === 'owner') {
    return { left: false, error: 'Owner cannot leave the community' };
  }

  await db
    .delete(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)));

  await db
    .update(communities)
    .set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` })
    .where(eq(communities.id, communityId));

  return { left: true };
}

export async function getMember(
  db: DB,
  communityId: string,
  userId: string,
): Promise<CommunityMemberItem | null> {
  const rows = await db
    .select({
      member: communityMembers,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communityMembers)
    .innerJoin(users, eq(communityMembers.userId, users.id))
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  return {
    communityId: row.member.communityId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user,
  };
}

export async function listMembers(db: DB, communityId: string): Promise<CommunityMemberItem[]> {
  const rows = await db
    .select({
      member: communityMembers,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communityMembers)
    .innerJoin(users, eq(communityMembers.userId, users.id))
    .where(eq(communityMembers.communityId, communityId))
    .orderBy(desc(communityMembers.joinedAt));

  return rows.map((row) => ({
    communityId: row.member.communityId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user,
  }));
}

export async function changeRole(
  db: DB,
  actorId: string,
  communityId: string,
  targetUserId: string,
  newRole: string,
): Promise<{ changed: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      )
      .limit(1),
  ]);

  if (actorMember.length === 0) {
    return { changed: false, error: 'Not a member' };
  }
  if (targetMember.length === 0) {
    return { changed: false, error: 'Target is not a member' };
  }

  if (!hasPermission(actorMember[0]!.role, 'manageMembers')) {
    return { changed: false, error: 'Insufficient permissions' };
  }
  if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
    return { changed: false, error: 'Cannot manage a user with equal or higher role' };
  }

  // Cannot promote to owner
  if (newRole === 'owner') {
    return { changed: false, error: 'Cannot promote to owner' };
  }

  await db
    .update(communityMembers)
    .set({ role: newRole as 'admin' | 'moderator' | 'member' })
    .where(
      and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId)),
    );

  return { changed: true };
}

export async function kickMember(
  db: DB,
  actorId: string,
  communityId: string,
  targetUserId: string,
): Promise<{ kicked: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      )
      .limit(1),
  ]);

  if (actorMember.length === 0) {
    return { kicked: false, error: 'Not a member' };
  }
  if (targetMember.length === 0) {
    return { kicked: false, error: 'Target is not a member' };
  }
  if (!hasPermission(actorMember[0]!.role, 'kickMember')) {
    return { kicked: false, error: 'Insufficient permissions' };
  }
  if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
    return { kicked: false, error: 'Cannot kick a user with equal or higher role' };
  }

  await db
    .delete(communityMembers)
    .where(
      and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId)),
    );

  await db
    .update(communities)
    .set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` })
    .where(eq(communities.id, communityId));

  return { kicked: true };
}

// --- Posts & Replies ---

export async function createPost(
  db: DB,
  authorId: string,
  input: { communityId: string; type?: string; content: string },
): Promise<CommunityPostItem> {
  // Membership required
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, input.communityId),
        eq(communityMembers.userId, authorId),
      ),
    )
    .limit(1);

  if (member.length === 0) {
    throw new Error('Must be a member to post');
  }

  const [post] = await db
    .insert(communityPosts)
    .values({
      communityId: input.communityId,
      authorId,
      type: (input.type as 'text' | 'link' | 'share' | 'poll') ?? 'text',
      content: input.content,
    })
    .returning();

  await db
    .update(communities)
    .set({ postCount: sql`${communities.postCount} + 1` })
    .where(eq(communities.id, input.communityId));

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
    id: post!.id,
    communityId: post!.communityId,
    type: post!.type,
    content: post!.content,
    isPinned: post!.isPinned,
    isLocked: post!.isLocked,
    likeCount: 0,
    replyCount: 0,
    createdAt: post!.createdAt,
    updatedAt: post!.updatedAt,
    author: author[0]!,
  };
}

export async function listPosts(
  db: DB,
  communityId: string,
  filters: Omit<CommunityPostFilters, 'communityId'> = {},
): Promise<{ items: CommunityPostItem[]; total: number }> {
  const conditions = [eq(communityPosts.communityId, communityId)];

  if (filters.type) {
    conditions.push(eq(communityPosts.type, filters.type as 'text' | 'link' | 'share' | 'poll'));
  }

  const where = and(...conditions);
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        post: communityPosts,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.authorId, users.id))
      .where(where)
      .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityPosts)
      .where(where),
  ]);

  const items: CommunityPostItem[] = rows.map((row) => {
    const item: CommunityPostItem = {
      id: row.post.id,
      communityId: row.post.communityId,
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

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function deletePost(
  db: DB,
  postId: string,
  userId: string,
  communityId: string,
): Promise<boolean> {
  const post = await db
    .select({ authorId: communityPosts.authorId })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);

  if (post.length === 0) return false;

  // Author can delete own post, or moderator+
  if (post[0]!.authorId !== userId) {
    const member = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)),
      )
      .limit(1);

    if (member.length === 0 || !hasPermission(member[0]!.role, 'deletePost')) {
      return false;
    }
  }

  await db.delete(communityPosts).where(eq(communityPosts.id, postId));

  await db
    .update(communities)
    .set({ postCount: sql`GREATEST(${communities.postCount} - 1, 0)` })
    .where(eq(communities.id, communityId));

  return true;
}

export async function togglePinPost(
  db: DB,
  postId: string,
  userId: string,
  communityId: string,
): Promise<{ pinned: boolean } | null> {
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'pinPost')) {
    return null;
  }

  const post = await db
    .select({ isPinned: communityPosts.isPinned })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);

  if (post.length === 0) return null;

  const newPinned = !post[0]!.isPinned;
  await db
    .update(communityPosts)
    .set({ isPinned: newPinned, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId));

  return { pinned: newPinned };
}

export async function toggleLockPost(
  db: DB,
  postId: string,
  userId: string,
  communityId: string,
): Promise<{ locked: boolean } | null> {
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'lockPost')) {
    return null;
  }

  const post = await db
    .select({ isLocked: communityPosts.isLocked })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);

  if (post.length === 0) return null;

  const newLocked = !post[0]!.isLocked;
  await db
    .update(communityPosts)
    .set({ isLocked: newLocked, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId));

  return { locked: newLocked };
}

export async function createReply(
  db: DB,
  authorId: string,
  input: { postId: string; content: string; parentId?: string },
): Promise<CommunityReplyItem> {
  // Check post exists and not locked
  const post = await db
    .select({ communityId: communityPosts.communityId, isLocked: communityPosts.isLocked })
    .from(communityPosts)
    .where(eq(communityPosts.id, input.postId))
    .limit(1);

  if (post.length === 0) throw new Error('Post not found');
  if (post[0]!.isLocked) throw new Error('Post is locked');

  // Membership required
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, post[0]!.communityId),
        eq(communityMembers.userId, authorId),
      ),
    )
    .limit(1);

  if (member.length === 0) throw new Error('Must be a member to reply');

  // Ban check
  const ban = await checkBan(db, post[0]!.communityId, authorId);
  if (ban) throw new Error('You are banned from this community');

  const [reply] = await db
    .insert(communityPostReplies)
    .values({
      postId: input.postId,
      authorId,
      content: input.content,
      parentId: input.parentId ?? null,
    })
    .returning();

  await db
    .update(communityPosts)
    .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
    .where(eq(communityPosts.id, input.postId));

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

export async function listReplies(db: DB, postId: string): Promise<CommunityReplyItem[]> {
  const rows = await db
    .select({
      reply: communityPostReplies,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communityPostReplies)
    .innerJoin(users, eq(communityPostReplies.authorId, users.id))
    .where(eq(communityPostReplies.postId, postId))
    .orderBy(desc(communityPostReplies.createdAt));

  // Build threaded structure
  const replyMap = new Map<string, CommunityReplyItem>();
  const rootReplies: CommunityReplyItem[] = [];

  for (const row of rows) {
    const item: CommunityReplyItem = {
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

  for (const item of replyMap.values()) {
    if (item.parentId && replyMap.has(item.parentId)) {
      replyMap.get(item.parentId)!.replies!.push(item);
    } else {
      rootReplies.push(item);
    }
  }

  return rootReplies;
}

export async function deleteReply(
  db: DB,
  replyId: string,
  userId: string,
  communityId: string,
): Promise<boolean> {
  const reply = await db
    .select({ authorId: communityPostReplies.authorId, postId: communityPostReplies.postId })
    .from(communityPostReplies)
    .where(eq(communityPostReplies.id, replyId))
    .limit(1);

  if (reply.length === 0) return false;

  // Author or moderator+
  if (reply[0]!.authorId !== userId) {
    const member = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)),
      )
      .limit(1);

    if (member.length === 0 || !hasPermission(member[0]!.role, 'deletePost')) {
      return false;
    }
  }

  await db.delete(communityPostReplies).where(eq(communityPostReplies.id, replyId));

  await db
    .update(communityPosts)
    .set({ replyCount: sql`GREATEST(${communityPosts.replyCount} - 1, 0)` })
    .where(eq(communityPosts.id, reply[0]!.postId));

  return true;
}

// --- Bans ---

export async function banUser(
  db: DB,
  actorId: string,
  communityId: string,
  targetUserId: string,
  reason?: string,
  expiresAt?: Date,
): Promise<{ banned: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      )
      .limit(1),
  ]);

  if (actorMember.length === 0 || !hasPermission(actorMember[0]!.role, 'banUser')) {
    return { banned: false, error: 'Insufficient permissions' };
  }

  // Moderators can only issue temporary bans
  if (actorMember[0]!.role === 'moderator' && !expiresAt) {
    return { banned: false, error: 'Moderators can only issue temporary bans' };
  }

  // Can only ban members with lower role (or non-members)
  if (targetMember.length > 0) {
    if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
      return { banned: false, error: 'Cannot ban a user with equal or higher role' };
    }

    // Remove from members
    await db
      .delete(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      );

    await db
      .update(communities)
      .set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` })
      .where(eq(communities.id, communityId));
  }

  await db.insert(communityBans).values({
    communityId,
    userId: targetUserId,
    bannedById: actorId,
    reason: reason ?? null,
    expiresAt: expiresAt ?? null,
  });

  return { banned: true };
}

export async function unbanUser(
  db: DB,
  actorId: string,
  communityId: string,
  targetUserId: string,
): Promise<{ unbanned: boolean; error?: string }> {
  const actorMember = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId)))
    .limit(1);

  if (actorMember.length === 0 || !hasPermission(actorMember[0]!.role, 'banUser')) {
    return { unbanned: false, error: 'Insufficient permissions' };
  }

  await db
    .delete(communityBans)
    .where(and(eq(communityBans.communityId, communityId), eq(communityBans.userId, targetUserId)));

  return { unbanned: true };
}

export async function checkBan(
  db: DB,
  communityId: string,
  userId: string,
): Promise<{ id: string; reason: string | null; expiresAt: Date | null } | null> {
  const rows = await db
    .select({
      id: communityBans.id,
      reason: communityBans.reason,
      expiresAt: communityBans.expiresAt,
    })
    .from(communityBans)
    .where(and(eq(communityBans.communityId, communityId), eq(communityBans.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const ban = rows[0]!;
  // Expired bans are not active — clean up the stale row
  if (ban.expiresAt && ban.expiresAt < new Date()) {
    await db.delete(communityBans).where(eq(communityBans.id, ban.id));
    return null;
  }

  return ban;
}

export async function listBans(db: DB, communityId: string): Promise<CommunityBanItem[]> {
  const rows = await db
    .select({
      ban: communityBans,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communityBans)
    .innerJoin(users, eq(communityBans.userId, users.id))
    .where(eq(communityBans.communityId, communityId))
    .orderBy(desc(communityBans.createdAt));

  // We need bannedBy info too — fetch separately to avoid ambiguous join
  const banIds = rows.map((r) => r.ban.bannedById);
  const uniqueBannerIds = [...new Set(banIds)];
  const banners = new Map<
    string,
    { id: string; username: string; displayName: string | null; avatarUrl: string | null }
  >();

  if (uniqueBannerIds.length > 0) {
    const bannerRows = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, uniqueBannerIds));
    for (const row of bannerRows) {
      banners.set(row.id, row);
    }
  }

  return rows.map((row) => ({
    id: row.ban.id,
    reason: row.ban.reason,
    expiresAt: row.ban.expiresAt,
    createdAt: row.ban.createdAt,
    user: row.user,
    bannedBy: banners.get(row.ban.bannedById) ?? {
      id: row.ban.bannedById,
      username: 'unknown',
      displayName: null,
      avatarUrl: null,
    },
  }));
}

// --- Invites ---

export async function createInvite(
  db: DB,
  userId: string,
  communityId: string,
  maxUses?: number,
  expiresAt?: Date,
): Promise<CommunityInviteItem | null> {
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'manageMembers')) {
    return null;
  }

  const token = crypto.randomUUID().replace(/-/g, '');

  const [invite] = await db
    .insert(communityInvites)
    .values({
      communityId,
      createdById: userId,
      token,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ?? null,
    })
    .returning();

  const author = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    id: invite!.id,
    token: invite!.token,
    maxUses: invite!.maxUses,
    useCount: 0,
    expiresAt: invite!.expiresAt,
    createdAt: invite!.createdAt,
    createdBy: author[0]!,
  };
}

export async function validateAndUseInvite(
  db: DB,
  token: string,
): Promise<{ valid: boolean; communityId?: string }> {
  // Atomic UPDATE: increment use_count only if within limits and not expired
  const updated = await db
    .update(communityInvites)
    .set({ useCount: sql`${communityInvites.useCount} + 1` })
    .where(
      and(
        eq(communityInvites.token, token),
        sql`(${communityInvites.expiresAt} IS NULL OR ${communityInvites.expiresAt} > NOW())`,
        sql`(${communityInvites.maxUses} IS NULL OR ${communityInvites.useCount} < ${communityInvites.maxUses})`,
      ),
    )
    .returning({ communityId: communityInvites.communityId });

  if (updated.length === 0) return { valid: false };

  return { valid: true, communityId: updated[0]!.communityId };
}

export async function revokeInvite(
  db: DB,
  inviteId: string,
  userId: string,
  communityId: string,
): Promise<boolean> {
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'manageMembers')) {
    return false;
  }

  await db.delete(communityInvites).where(eq(communityInvites.id, inviteId));
  return true;
}

export async function listInvites(db: DB, communityId: string): Promise<CommunityInviteItem[]> {
  const rows = await db
    .select({
      invite: communityInvites,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communityInvites)
    .innerJoin(users, eq(communityInvites.createdById, users.id))
    .where(eq(communityInvites.communityId, communityId))
    .orderBy(desc(communityInvites.createdAt));

  return rows.map((row) => ({
    id: row.invite.id,
    token: row.invite.token,
    maxUses: row.invite.maxUses,
    useCount: row.invite.useCount,
    expiresAt: row.invite.expiresAt,
    createdAt: row.invite.createdAt,
    createdBy: row.createdBy,
  }));
}

// --- Content Sharing ---

export async function shareContent(
  db: DB,
  userId: string,
  communityId: string,
  contentId: string,
): Promise<CommunityPostItem | null> {
  // Membership required
  const member = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) return null;

  // Get content details
  const content = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      slug: contentItems.slug,
      type: contentItems.type,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (content.length === 0) return null;

  const shareContent = JSON.stringify({
    contentId: content[0]!.id,
    title: content[0]!.title,
    slug: content[0]!.slug,
    type: content[0]!.type,
  });

  // Create share row
  await db.insert(communityShares).values({
    communityId,
    contentId,
    sharedById: userId,
  });

  // Create share post
  return createPost(db, userId, {
    communityId,
    type: 'share',
    content: shareContent,
  });
}

export async function unshareContent(
  db: DB,
  userId: string,
  communityId: string,
  contentId: string,
): Promise<boolean> {
  const share = await db
    .select({ id: communityShares.id })
    .from(communityShares)
    .where(
      and(
        eq(communityShares.communityId, communityId),
        eq(communityShares.contentId, contentId),
        eq(communityShares.sharedById, userId),
      ),
    )
    .limit(1);

  if (share.length === 0) return false;

  await db.delete(communityShares).where(eq(communityShares.id, share[0]!.id));
  return true;
}

export async function listShares(
  db: DB,
  communityId: string,
): Promise<Array<{ id: string; contentId: string; sharedById: string; createdAt: Date }>> {
  return db
    .select({
      id: communityShares.id,
      contentId: communityShares.contentId,
      sharedById: communityShares.sharedById,
      createdAt: communityShares.createdAt,
    })
    .from(communityShares)
    .where(eq(communityShares.communityId, communityId))
    .orderBy(desc(communityShares.createdAt));
}
