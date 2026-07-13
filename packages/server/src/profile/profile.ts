import { eq, and, or, sql, ilike, isNull } from 'drizzle-orm';
import { contentItems, users, follows } from '@commonpub/schema';
import type { ContentType } from '@commonpub/schema';
import type { DB, ContentListItem, UserProfile } from '../types.js';
import { listContentKeyset } from '../content/content.js';
import { visibleContentWhere } from '../content/visibility.js';

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Minimal user lookup by username/display name for invite pickers (contest
 * judges/reviewers, etc.). Returns PUBLIC fields only — never email/role — so it
 * is safe to expose to non-admin contest managers, unlike the admin user list.
 * Soft-deleted users are excluded; LIKE metacharacters in the query are escaped.
 */
export async function searchUsers(db: DB, query: string, limit = 10): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Escape %, _ and \ so they match literally (backslash is PG LIKE's default escape).
  const term = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const capped = Math.min(Math.max(1, Math.trunc(limit) || 1), 25);
  return db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(and(isNull(users.deletedAt), or(ilike(users.username, term), ilike(users.displayName, term))))
    .orderBy(users.username)
    .limit(capped);
}

export async function getUserByUsername(db: DB, username: string): Promise<UserProfile | null> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;

  const user = rows[0]!;

  // Get content counts by type + aggregated view/like counts
  const [contentCounts, viewLikeResult, followerResult, followingResult] = await Promise.all([
    db
      .select({
        type: contentItems.type,
        count: sql<number>`count(*)::int`,
      })
      .from(contentItems)
      // Public profile stats count/aggregate the author's live-public work only.
      // Without the visibility gate, per-type counts + totalViews/totalLikes reveal
      // the volume/engagement of members/private (and soft-deleted) items (P-1b).
      .where(and(visibleContentWhere(), eq(contentItems.authorId, user.id)))
      .groupBy(contentItems.type),
    db
      .select({
        totalViews: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::int`,
        totalLikes: sql<number>`coalesce(sum(${contentItems.likeCount}), 0)::int`,
      })
      .from(contentItems)
      .where(and(visibleContentWhere(), eq(contentItems.authorId, user.id))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, user.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, user.id)),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of contentCounts) {
    countMap[row.type] = row.count;
  }

  const followerCount = followerResult[0]?.count ?? 0;
  const followingCount = followingResult[0]?.count ?? 0;

  const socialLinks = (user.socialLinks as UserProfile['socialLinks']) ?? null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio ?? null,
    headline: user.headline ?? null,
    location: user.location ?? null,
    website: user.website ?? null,
    bannerUrl: user.bannerUrl ?? null,
    socialLinks,
    skills: (user.skills as string[]) ?? null,
    experience: (user.experience as UserProfile['experience']) ?? null,
    pronouns: user.pronouns ?? null,
    emailNotifications: (user.emailNotifications as UserProfile['emailNotifications']) ?? null,
    createdAt: user.createdAt,
    followerCount,
    followingCount,
    viewCount: viewLikeResult[0]?.totalViews ?? 0,
    likeCount: viewLikeResult[0]?.totalLikes ?? 0,
    stats: {
      projects: countMap['project'] ?? 0,
      explainers: countMap['explainer'] ?? 0,
      articles: (countMap['blog'] ?? 0) + (countMap['article'] ?? 0),
      followers: followerCount,
      following: followingCount,
    },
  };
}

export async function updateUserProfile(
  db: DB,
  userId: string,
  input: {
    displayName?: string;
    bio?: string;
    headline?: string;
    location?: string;
    website?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    socialLinks?: Record<string, string | undefined>;
    skills?: string[];
    experience?: Array<{
      title: string;
      company: string;
      startDate: string;
      endDate: string;
      description: string;
    }>;
    pronouns?: string;
    timezone?: string;
    emailNotifications?: {
      digest?: 'daily' | 'weekly' | 'none';
      likes?: boolean;
      comments?: boolean;
      follows?: boolean;
      mentions?: boolean;
    };
  },
): Promise<UserProfile | null> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length === 0) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.displayName !== undefined) updates.displayName = input.displayName;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.headline !== undefined) updates.headline = input.headline;
  if (input.location !== undefined) updates.location = input.location;
  if (input.website !== undefined) updates.website = input.website;
  if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
  if (input.bannerUrl !== undefined) updates.bannerUrl = input.bannerUrl;
  if (input.socialLinks !== undefined) updates.socialLinks = input.socialLinks;
  if (input.skills !== undefined) updates.skills = input.skills;
  if (input.experience !== undefined) updates.experience = input.experience;
  if (input.pronouns !== undefined) updates.pronouns = input.pronouns;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.emailNotifications !== undefined) updates.emailNotifications = input.emailNotifications;

  await db.update(users).set(updates).where(eq(users.id, userId));

  const user = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return getUserByUsername(db, user[0]!.username);
}

export interface GetUserContentOptions {
  type?: ContentType;
  cursor?: string | null;
  limit?: number;
  /** Caller's intent to view unpublished work — honoured ONLY for the owner. */
  drafts?: boolean;
  /** The authenticated viewer's id (resolved server-side, never a client param). */
  viewerId?: string;
}

export async function getUserContent(
  db: DB,
  profileUserId: string,
  opts: GetUserContentOptions = {},
): Promise<{ items: ContentListItem[]; nextCursor: string | null }> {
  // Draft visibility is decided HERE from the authenticated viewer — never from a
  // client-supplied status — so only the profile owner can see their own drafts.
  // A non-owner (or anonymous) requesting drafts silently falls back to published.
  const isOwner = !!opts.viewerId && opts.viewerId === profileUserId;
  const status = opts.drafts && isOwner ? 'draft' : 'published';

  return listContentKeyset(db, {
    authorId: profileUserId,
    status,
    // Only the owner sees their own members/private items; a non-owner (or anon) is
    // restricted to public, matching resolveContentQuery. Without this the profile
    // listing leaked the author "Members only"/"Only you" content (P-1 site 8).
    visibility: isOwner ? undefined : 'public',
    type: opts.type,
    cursor: opts.cursor ?? undefined,
    limit: opts.limit ?? 20,
  });
}
