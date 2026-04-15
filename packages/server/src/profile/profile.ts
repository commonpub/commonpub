import { eq, and, sql, isNull } from 'drizzle-orm';
import { contentItems, users, follows } from '@commonpub/schema';
import type { ContentType } from '@commonpub/schema';
import type { DB, ContentListItem, UserProfile } from '../types.js';
import { listContent } from '../content/content.js';

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
      .where(and(eq(contentItems.authorId, user.id), eq(contentItems.status, 'published')))
      .groupBy(contentItems.type),
    db
      .select({
        totalViews: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::int`,
        totalLikes: sql<number>`coalesce(sum(${contentItems.likeCount}), 0)::int`,
      })
      .from(contentItems)
      .where(and(eq(contentItems.authorId, user.id), eq(contentItems.status, 'published'))),
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

export async function getUserContent(
  db: DB,
  userId: string,
  type?: ContentType,
): Promise<{ items: ContentListItem[]; total: number }> {
  return listContent(db, {
    authorId: userId,
    status: 'published',
    type,
    limit: 20,
  });
}
