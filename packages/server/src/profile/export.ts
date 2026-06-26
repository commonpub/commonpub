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
  userConsents,
  hubs,
  hubMembers,
  enrollments,
  learningPaths,
  events,
  eventAttendees,
  contests,
  contestEntries,
  contestEntryPrivateFields,
  contestAgreementAcceptances,
  contestEntryVotes,
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
  // GDPR completeness (session 227): sections previously omitted so the export
  // matches both the privacy policy's promise and the deletion cascade's reach.
  consents: Array<Record<string, unknown>>;
  votes: Array<Record<string, unknown>>;
  hubMemberships: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  eventRsvps: Array<Record<string, unknown>>;
  contestEntries: Array<Record<string, unknown>>;
  contestPersonalData: Array<Record<string, unknown>>;
  contestAgreements: Array<Record<string, unknown>>;
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
      // Fully-qualify the correlated id: a bare ${contentItems.id} renders as
      // "id", which is ambiguous against the subquery's joined tags.id (Postgres
      // 42702). Qualify it so it binds to the outer content row unambiguously.
      tags: sql<string[]>`(
        SELECT COALESCE(array_agg(t.name), '{}')
        FROM content_tags ct
        JOIN tags t ON t.id = ct.tag_id
        WHERE ct.content_id = ${sql.raw('"content_items"."id"')}
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

  // GDPR-completeness sections (session 227). A second batch keeps the diff
  // localized; an export is rare/admin-ish so the extra round-trip is fine.
  const [
    consents,
    votes,
    hubMemberships,
    learningEnrollments,
    eventsCreated,
    eventRsvps,
    contestEntryRows,
    contestPersonalData,
    contestAgreements,
  ] = await Promise.all([
    // Consent audit trail
    db.select({
      kind: userConsents.kind,
      version: userConsents.version,
      acceptedAt: userConsents.acceptedAt,
    }).from(userConsents).where(eq(userConsents.userId, userId)),

    // Contest votes cast
    db.select({
      entryId: contestEntryVotes.entryId,
      createdAt: contestEntryVotes.createdAt,
    }).from(contestEntryVotes).where(eq(contestEntryVotes.userId, userId)),

    // Hub memberships
    db.select({
      hubSlug: hubs.slug,
      hubName: hubs.name,
      role: hubMembers.role,
      status: hubMembers.status,
      joinedAt: hubMembers.joinedAt,
    }).from(hubMembers)
      .innerJoin(hubs, eq(hubs.id, hubMembers.hubId))
      .where(eq(hubMembers.userId, userId)),

    // Learning path enrollments
    db.select({
      pathSlug: learningPaths.slug,
      pathTitle: learningPaths.title,
      progress: enrollments.progress,
      startedAt: enrollments.startedAt,
      completedAt: enrollments.completedAt,
    }).from(enrollments)
      .innerJoin(learningPaths, eq(learningPaths.id, enrollments.pathId))
      .where(eq(enrollments.userId, userId)),

    // Events created
    db.select({
      title: events.title,
      slug: events.slug,
      status: events.status,
      startDate: events.startDate,
      createdAt: events.createdAt,
    }).from(events).where(eq(events.createdById, userId)),

    // Event RSVPs
    db.select({
      eventTitle: events.title,
      eventSlug: events.slug,
      status: eventAttendees.status,
      registeredAt: eventAttendees.registeredAt,
    }).from(eventAttendees)
      .innerJoin(events, eq(events.id, eventAttendees.eventId))
      .where(eq(eventAttendees.userId, userId)),

    // Contest entries (the user's own, incl. their public stage artifacts)
    db.select({
      contestSlug: contests.slug,
      contestTitle: contests.title,
      stageSubmissions: contestEntries.stageSubmissions,
      submittedAt: contestEntries.submittedAt,
    }).from(contestEntries)
      .innerJoin(contests, eq(contests.id, contestEntries.contestId))
      .where(eq(contestEntries.userId, userId)),

    // Contest personal data (the entrant's OWN partitioned PII)
    db.select({
      fields: contestEntryPrivateFields.fields,
      createdAt: contestEntryPrivateFields.createdAt,
    }).from(contestEntryPrivateFields).where(eq(contestEntryPrivateFields.userId, userId)),

    // Contest agreement acceptances (the user's own consent snapshots)
    db.select({
      fieldKey: contestAgreementAcceptances.fieldKey,
      termsSnapshot: contestAgreementAcceptances.termsSnapshot,
      termsHash: contestAgreementAcceptances.termsHash,
      acceptedAt: contestAgreementAcceptances.acceptedAt,
    }).from(contestAgreementAcceptances).where(eq(contestAgreementAcceptances.userId, userId)),
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
    consents: consents as Record<string, unknown>[],
    votes: votes as Record<string, unknown>[],
    hubMemberships: hubMemberships as Record<string, unknown>[],
    enrollments: learningEnrollments as Record<string, unknown>[],
    events: eventsCreated as Record<string, unknown>[],
    eventRsvps: eventRsvps as Record<string, unknown>[],
    contestEntries: contestEntryRows as Record<string, unknown>[],
    contestPersonalData: contestPersonalData as Record<string, unknown>[],
    contestAgreements: contestAgreements as Record<string, unknown>[],
  };
}
