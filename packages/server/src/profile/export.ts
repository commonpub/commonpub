import type { DB } from '../types.js';
import {
  users,
  contentItems,
  comments,
  likes,
  follows,
  bookmarks,
  notifications,
  messages,
} from '@commonpub/schema';
import { eq, sql } from 'drizzle-orm';

export interface UserDataExport {
  exportedAt: string;
  profile: Record<string, unknown>;
  content: Array<Record<string, unknown>>;
  comments: Array<Record<string, unknown>>;
  likes: Array<Record<string, unknown>>;
  follows: {
    following: Array<{ username: string; followedAt: string }>;
    followers: Array<{ username: string; followedAt: string }>;
  };
  bookmarks: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
}

/**
 * Export all data associated with a user in a machine-readable format.
 * Satisfies GDPR Article 20 (right to data portability).
 */
export async function exportUserData(db: DB, userId: string): Promise<UserDataExport> {
  const [profile, content, userComments, userLikes, following, followers, userBookmarks, userNotifications, userMessages] = await Promise.all([
    // Profile
    db.select({
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      bio: users.bio,
      headline: users.headline,
      location: users.location,
      website: users.website,
      avatarUrl: users.avatarUrl,
      bannerUrl: users.bannerUrl,
      socialLinks: users.socialLinks,
      skills: users.skills,
      experience: users.experience,
      pronouns: users.pronouns,
      timezone: users.timezone,
      emailNotifications: users.emailNotifications,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1),

    // Content
    db.select({
      type: contentItems.type,
      title: contentItems.title,
      slug: contentItems.slug,
      description: contentItems.description,
      content: contentItems.content,
      coverImageUrl: contentItems.coverImageUrl,
      status: contentItems.status,
      difficulty: contentItems.difficulty,
      tags: sql<string[]>`(
        SELECT COALESCE(array_agg(t.name), '{}')
        FROM content_tags ct
        JOIN tags t ON t.id = ct.tag_id
        WHERE ct.content_id = ${contentItems.id}
      )`,
      createdAt: contentItems.createdAt,
      publishedAt: contentItems.publishedAt,
    }).from(contentItems).where(eq(contentItems.authorId, userId)),

    // Comments
    db.select({
      content: comments.content,
      targetType: comments.targetType,
      targetId: comments.targetId,
      createdAt: comments.createdAt,
    }).from(comments).where(eq(comments.authorId, userId)),

    // Likes
    db.select({
      targetType: likes.targetType,
      targetId: likes.targetId,
      createdAt: likes.createdAt,
    }).from(likes).where(eq(likes.userId, userId)),

    // Following
    db.select({
      username: users.username,
      followedAt: follows.createdAt,
    }).from(follows)
      .innerJoin(users, eq(users.id, follows.followingId))
      .where(eq(follows.followerId, userId)),

    // Followers
    db.select({
      username: users.username,
      followedAt: follows.createdAt,
    }).from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(eq(follows.followingId, userId)),

    // Bookmarks
    db.select({
      targetType: bookmarks.targetType,
      targetId: bookmarks.targetId,
      createdAt: bookmarks.createdAt,
    }).from(bookmarks).where(eq(bookmarks.userId, userId)),

    // Notifications
    db.select({
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
    }).from(notifications).where(eq(notifications.userId, userId)),

    // Messages
    db.select({
      body: messages.body,
      conversationId: messages.conversationId,
      createdAt: messages.createdAt,
    }).from(messages).where(eq(messages.senderId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: profile[0] ?? {},
    content: content as Record<string, unknown>[],
    comments: userComments as Record<string, unknown>[],
    likes: userLikes as Record<string, unknown>[],
    follows: {
      following: following.map(f => ({
        username: f.username,
        followedAt: String(f.followedAt),
      })),
      followers: followers.map(f => ({
        username: f.username,
        followedAt: String(f.followedAt),
      })),
    },
    bookmarks: userBookmarks as Record<string, unknown>[],
    notifications: userNotifications as Record<string, unknown>[],
    messages: userMessages as Record<string, unknown>[],
  };
}
