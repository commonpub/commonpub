import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import {
  hubs,
  hubMembers,
  hubPosts,
  hubPostReplies,
  hubBans,
  hubInvites,
  hubShares,
  contentItems,
  users,
} from '@commonpub/schema';
import type {
  DB,
  HubListItem,
  HubDetail,
  HubMemberItem,
  HubPostItem,
  HubReplyItem,
  HubPostFilters,
  HubFilters,
  HubInviteItem,
  HubBanItem,
  HubRole,
  JoinPolicy,
  PostType,
} from './types.js';
import { generateSlug, hasPermission, canManageRole } from './utils.js';

// --- Slug Helper ---

async function ensureUniqueHubSlug(
  db: DB,
  slug: string,
  excludeId?: string,
): Promise<string> {
  if (!slug) slug = `hub-${Date.now()}`;

  const conditions = [eq(hubs.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(hubs.id, excludeId));
  }

  const existing = await db
    .select({ id: hubs.id })
    .from(hubs)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) return slug;
  return `${slug}-${Date.now()}`;
}

// --- Hub CRUD ---

export async function listHubs(
  db: DB,
  filters: HubFilters = {},
): Promise<{ items: HubListItem[]; total: number }> {
  const conditions = [];

  if (filters.search) {
    conditions.push(ilike(hubs.name, `%${filters.search}%`));
  }
  if (filters.joinPolicy) {
    conditions.push(
      eq(hubs.joinPolicy, filters.joinPolicy),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        hub: hubs,
        createdBy: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(hubs)
      .innerJoin(users, eq(hubs.createdById, users.id))
      .where(where)
      .orderBy(desc(hubs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(hubs)
      .where(where),
  ]);

  const items: HubListItem[] = rows.map((row) => ({
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.slug,
    description: row.hub.description,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    joinPolicy: row.hub.joinPolicy,
    isOfficial: row.hub.isOfficial,
    memberCount: row.hub.memberCount,
    postCount: row.hub.postCount,
    createdAt: row.hub.createdAt,
    createdBy: row.createdBy,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getHubBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
): Promise<HubDetail | null> {
  const rows = await db
    .select({
      hub: hubs,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubs)
    .innerJoin(users, eq(hubs.createdById, users.id))
    .where(eq(hubs.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  let currentUserRole: HubRole | null = null;
  let isBanned = false;

  if (requesterId) {
    const [memberRows, banResult] = await Promise.all([
      db
        .select({ role: hubMembers.role })
        .from(hubMembers)
        .where(
          and(
            eq(hubMembers.hubId, row.hub.id),
            eq(hubMembers.userId, requesterId),
          ),
        )
        .limit(1),
      checkBan(db, row.hub.id, requesterId),
    ]);

    currentUserRole = memberRows[0]?.role ?? null;
    isBanned = banResult !== null;
  }

  return {
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.slug,
    description: row.hub.description,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    joinPolicy: row.hub.joinPolicy,
    isOfficial: row.hub.isOfficial,
    memberCount: row.hub.memberCount,
    postCount: row.hub.postCount,
    createdAt: row.hub.createdAt,
    createdBy: row.createdBy,
    rules: row.hub.rules,
    updatedAt: row.hub.updatedAt,
    currentUserRole,
    isBanned,
    hubType: row.hub.hubType,
    privacy: row.hub.privacy,
    website: row.hub.website,
    categories: row.hub.categories,
  };
}

export async function createHub(
  db: DB,
  userId: string,
  input: { name: string; description?: string; rules?: string; joinPolicy?: JoinPolicy },
): Promise<HubDetail> {
  const slug = await ensureUniqueHubSlug(db, generateSlug(input.name));

  const [inserted] = await db
    .insert(hubs)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      rules: input.rules ?? null,
      joinPolicy: input.joinPolicy ?? 'open',
      createdById: userId,
      memberCount: 1,
    })
    .returning();

  // Auto-add creator as owner
  await db.insert(hubMembers).values({
    hubId: inserted!.id,
    userId,
    role: 'owner',
  });

  return (await getHubBySlug(db, inserted!.slug, userId))!;
}

export async function updateHub(
  db: DB,
  hubId: string,
  userId: string,
  input: {
    name?: string;
    description?: string;
    rules?: string;
    joinPolicy?: string;
    iconUrl?: string;
    bannerUrl?: string;
  },
): Promise<HubDetail | null> {
  // Permission check: must be admin+
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'editHub')) {
    return null;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = await ensureUniqueHubSlug(db, generateSlug(input.name), hubId);
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.rules !== undefined) updates.rules = input.rules;
  if (input.joinPolicy !== undefined) updates.joinPolicy = input.joinPolicy;
  if (input.iconUrl !== undefined) updates.iconUrl = input.iconUrl;
  if (input.bannerUrl !== undefined) updates.bannerUrl = input.bannerUrl;

  await db.update(hubs).set(updates).where(eq(hubs.id, hubId));

  const slug = (updates.slug as string) ?? undefined;
  if (slug) {
    return getHubBySlug(db, slug, userId);
  }

  // Fetch updated hub
  const current = await db
    .select({ slug: hubs.slug })
    .from(hubs)
    .where(eq(hubs.id, hubId))
    .limit(1);

  return getHubBySlug(db, current[0]!.slug, userId);
}

export async function deleteHub(
  db: DB,
  hubId: string,
  userId: string,
): Promise<boolean> {
  // Owner only
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || member[0]!.role !== 'owner') {
    return false;
  }

  await db.delete(hubs).where(eq(hubs.id, hubId));
  return true;
}

// --- Membership ---

export async function joinHub(
  db: DB,
  userId: string,
  hubId: string,
  inviteToken?: string,
): Promise<{ joined: boolean; error?: string }> {
  // Check ban
  const ban = await checkBan(db, hubId, userId);
  if (ban) {
    return { joined: false, error: 'You are banned from this hub' };
  }

  // Check join policy
  const hubRow = await db
    .select({ joinPolicy: hubs.joinPolicy })
    .from(hubs)
    .where(eq(hubs.id, hubId))
    .limit(1);

  if (hubRow.length === 0) {
    return { joined: false, error: 'Hub not found' };
  }

  const policy = hubRow[0]!.joinPolicy;

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
    const inserted = await tx
      .insert(hubMembers)
      .values({ hubId, userId, role: 'member' })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      return { joined: true };
    }

    await tx
      .update(hubs)
      .set({ memberCount: sql`${hubs.memberCount} + 1` })
      .where(eq(hubs.id, hubId));

    return { joined: true };
  });
}

export async function leaveHub(
  db: DB,
  userId: string,
  hubId: string,
): Promise<{ left: boolean; error?: string }> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) {
    return { left: false, error: 'Not a member' };
  }

  if (member[0]!.role === 'owner') {
    return { left: false, error: 'Owner cannot leave the hub' };
  }

  await db
    .delete(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)));

  await db
    .update(hubs)
    .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
    .where(eq(hubs.id, hubId));

  return { left: true };
}

export async function getMember(
  db: DB,
  hubId: string,
  userId: string,
): Promise<HubMemberItem | null> {
  const rows = await db
    .select({
      member: hubMembers,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubMembers)
    .innerJoin(users, eq(hubMembers.userId, users.id))
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  return {
    hubId: row.member.hubId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user,
  };
}

export async function listMembers(db: DB, hubId: string): Promise<HubMemberItem[]> {
  const rows = await db
    .select({
      member: hubMembers,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubMembers)
    .innerJoin(users, eq(hubMembers.userId, users.id))
    .where(eq(hubMembers.hubId, hubId))
    .orderBy(desc(hubMembers.joinedAt));

  return rows.map((row) => ({
    hubId: row.member.hubId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user,
  }));
}

export async function changeRole(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
  newRole: HubRole,
): Promise<{ changed: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
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

  if (newRole === 'owner') {
    return { changed: false, error: 'Cannot promote to owner' };
  }

  await db
    .update(hubMembers)
    .set({ role: newRole })
    .where(
      and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)),
    );

  return { changed: true };
}

export async function kickMember(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
): Promise<{ kicked: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
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
    .delete(hubMembers)
    .where(
      and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)),
    );

  await db
    .update(hubs)
    .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
    .where(eq(hubs.id, hubId));

  return { kicked: true };
}

// --- Posts & Replies ---

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

  const [post] = await db
    .insert(hubPosts)
    .values({
      hubId: input.hubId,
      authorId,
      type: input.type ?? 'text',
      content: input.content,
    })
    .returning();

  await db
    .update(hubs)
    .set({ postCount: sql`${hubs.postCount} + 1` })
    .where(eq(hubs.id, input.hubId));

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
    hubId: post!.hubId,
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
  hubId: string,
  filters: Omit<HubPostFilters, 'hubId'> = {},
): Promise<{ items: HubPostItem[]; total: number }> {
  const conditions = [eq(hubPosts.hubId, hubId)];

  if (filters.type) {
    conditions.push(eq(hubPosts.type, filters.type));
  }

  const where = and(...conditions);
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        post: hubPosts,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(hubPosts)
      .innerJoin(users, eq(hubPosts.authorId, users.id))
      .where(where)
      .orderBy(desc(hubPosts.isPinned), desc(hubPosts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(hubPosts)
      .where(where),
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

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function deletePost(
  db: DB,
  postId: string,
  userId: string,
  hubId: string,
): Promise<boolean> {
  const post = await db
    .select({ authorId: hubPosts.authorId })
    .from(hubPosts)
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (post.length === 0) return false;

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

export async function listReplies(db: DB, postId: string): Promise<HubReplyItem[]> {
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
    .where(eq(hubPostReplies.postId, postId))
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
  hubId: string,
): Promise<boolean> {
  const reply = await db
    .select({ authorId: hubPostReplies.authorId, postId: hubPostReplies.postId })
    .from(hubPostReplies)
    .where(eq(hubPostReplies.id, replyId))
    .limit(1);

  if (reply.length === 0) return false;

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

// --- Bans ---

export async function banUser(
  db: DB,
  actorId: string,
  hubId: string,
  targetUserId: string,
  reason?: string,
  expiresAt?: Date,
): Promise<{ banned: boolean; error?: string }> {
  const [actorMember, targetMember] = await Promise.all([
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)),
      )
      .limit(1),
    db
      .select({ role: hubMembers.role })
      .from(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
        ),
      )
      .limit(1),
  ]);

  if (actorMember.length === 0 || !hasPermission(actorMember[0]!.role, 'banUser')) {
    return { banned: false, error: 'Insufficient permissions' };
  }

  if (actorMember[0]!.role === 'moderator' && !expiresAt) {
    return { banned: false, error: 'Moderators can only issue temporary bans' };
  }

  if (targetMember.length > 0) {
    if (!canManageRole(actorMember[0]!.role, targetMember[0]!.role)) {
      return { banned: false, error: 'Cannot ban a user with equal or higher role' };
    }

    await db
      .delete(hubMembers)
      .where(
        and(
          eq(hubMembers.hubId, hubId),
          eq(hubMembers.userId, targetUserId),
        ),
      );

    await db
      .update(hubs)
      .set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` })
      .where(eq(hubs.id, hubId));
  }

  await db.insert(hubBans).values({
    hubId,
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
  hubId: string,
  targetUserId: string,
): Promise<{ unbanned: boolean; error?: string }> {
  const actorMember = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId)))
    .limit(1);

  if (actorMember.length === 0 || !hasPermission(actorMember[0]!.role, 'banUser')) {
    return { unbanned: false, error: 'Insufficient permissions' };
  }

  await db
    .delete(hubBans)
    .where(and(eq(hubBans.hubId, hubId), eq(hubBans.userId, targetUserId)));

  return { unbanned: true };
}

export async function checkBan(
  db: DB,
  hubId: string,
  userId: string,
): Promise<{ id: string; reason: string | null; expiresAt: Date | null } | null> {
  const rows = await db
    .select({
      id: hubBans.id,
      reason: hubBans.reason,
      expiresAt: hubBans.expiresAt,
    })
    .from(hubBans)
    .where(and(eq(hubBans.hubId, hubId), eq(hubBans.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const ban = rows[0]!;
  if (ban.expiresAt && ban.expiresAt < new Date()) {
    await db.delete(hubBans).where(eq(hubBans.id, ban.id));
    return null;
  }

  return ban;
}

export async function listBans(db: DB, hubId: string): Promise<HubBanItem[]> {
  const rows = await db
    .select({
      ban: hubBans,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubBans)
    .innerJoin(users, eq(hubBans.userId, users.id))
    .where(eq(hubBans.hubId, hubId))
    .orderBy(desc(hubBans.createdAt));

  const banIds = rows.map((r) => r.ban.bannedById);
  const uniqueBannerIds = [...new Set(banIds)];
  const banners = new Map<
    string,
    { id: string; username: string; displayName: string | null; avatarUrl: string | null }
  >();

  if (uniqueBannerIds.length > 0) {
    const bannerRows = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
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
  hubId: string,
  maxUses?: number,
  expiresAt?: Date,
): Promise<HubInviteItem | null> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'manageMembers')) {
    return null;
  }

  const token = crypto.randomUUID().replace(/-/g, '');

  const [invite] = await db
    .insert(hubInvites)
    .values({
      hubId,
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
): Promise<{ valid: boolean; hubId?: string }> {
  const updated = await db
    .update(hubInvites)
    .set({ useCount: sql`${hubInvites.useCount} + 1` })
    .where(
      and(
        eq(hubInvites.token, token),
        sql`(${hubInvites.expiresAt} IS NULL OR ${hubInvites.expiresAt} > NOW())`,
        sql`(${hubInvites.maxUses} IS NULL OR ${hubInvites.useCount} < ${hubInvites.maxUses})`,
      ),
    )
    .returning({ hubId: hubInvites.hubId });

  if (updated.length === 0) return { valid: false };

  return { valid: true, hubId: updated[0]!.hubId };
}

export async function revokeInvite(
  db: DB,
  inviteId: string,
  userId: string,
  hubId: string,
): Promise<boolean> {
  const member = await db
    .select({ role: hubMembers.role })
    .from(hubMembers)
    .where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)))
    .limit(1);

  if (member.length === 0 || !hasPermission(member[0]!.role, 'manageMembers')) {
    return false;
  }

  await db.delete(hubInvites).where(eq(hubInvites.id, inviteId));
  return true;
}

export async function listInvites(db: DB, hubId: string): Promise<HubInviteItem[]> {
  const rows = await db
    .select({
      invite: hubInvites,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(hubInvites)
    .innerJoin(users, eq(hubInvites.createdById, users.id))
    .where(eq(hubInvites.hubId, hubId))
    .orderBy(desc(hubInvites.createdAt));

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
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (content.length === 0) return null;

  const sharePayload = JSON.stringify({
    contentId: content[0]!.id,
    title: content[0]!.title,
    slug: content[0]!.slug,
    type: content[0]!.type,
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
