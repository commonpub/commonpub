import type { DB } from '../types.js';
import {
  users,
  contentItems,
  contentVersions,
  comments,
  likes,
  follows,
  bookmarks,
  notifications,
  messages,
  userConsents,
  hubs,
  hubMembers,
  hubPosts,
  hubPostReplies,
  enrollments,
  learningPaths,
  certificates,
  events,
  eventAttendees,
  contests,
  contestEntries,
  contestEntryPrivateFields,
  contestRegistrationPrivateFields,
  contestAgreementAcceptances,
  contestEntryVotes,
  referralLinks,
  referralAttributions,
  videos,
  products,
  docsSites,
  reports,
  hubFlags,
  files,
} from '@commonpub/schema';
import { eq, sql } from 'drizzle-orm';

// SECURITY / THIRD-PARTY EXCLUSIONS (session 231 round-6 audit) — deliberately
// NOT exported here; adding them would leak secrets or other people's data:
//   - actor_keypairs / hub_actor_keypairs : PRIVATE federation signing keys.
//   - sessions, accounts                  : auth tokens & credentials.
//   - audit_logs                          : rows reference third-party targets/actions.
//   - email_outbox, broadcasts            : operational queues (not subject data).
//   - content_builds / federated_content_builds : transient render artifacts.
// The export is scoped to the SUBJECT's own rows only; where a row also names a
// third party (reports, referral attributions) we select the subject's own
// fields and omit the other party's identifiers/PII.

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
  contestRegistrationPersonalData: Array<Record<string, unknown>>;
  contestAgreements: Array<Record<string, unknown>>;
  // GDPR round-6 completeness (session 231): authored/identifying subject data
  // that was previously omitted. Each is scoped to the subject's own rows.
  referralLinks: Array<Record<string, unknown>>;
  referralAttributions: Array<Record<string, unknown>>;
  hubPosts: Array<Record<string, unknown>>;
  hubPostReplies: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  learningPathsAuthored: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  docsSites: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  hubFlags: Array<Record<string, unknown>>;
  certificates: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  contentVersions: Array<Record<string, unknown>>;
}

/**
 * Export the data CommonPub holds about a single user, in a machine-readable
 * format, to support GDPR Art. 15 (access) / Art. 20 (portability) requests.
 *
 * SCOPE (bounded — this is NOT full deletion-cascade parity): the export
 * returns the subject's OWN rows across profile, authored content and content
 * versions, comments/likes/bookmarks, follows, notifications, sent messages,
 * consents (incl. IP/UA audit), contest entries + partitioned PII + agreement
 * acceptances, hub memberships + authored hub posts/replies, learning
 * enrollments + authored paths + certificates, events + RSVPs, videos,
 * products, docs sites, uploaded files, referral links + own attribution,
 * contest votes cast, and reports + hub moderation flags the user raised (their
 * statement only). It deliberately EXCLUDES
 * secrets (keypairs, sessions, accounts) and third-party-bearing tables
 * (audit_logs) — see the exclusion note at the top of this module. Rows that
 * name a third party are projected down to the subject's own fields.
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
      // G1: denormalized terms-acceptance audit fields.
      acceptedTermsAt: users.acceptedTermsAt,
      acceptedTermsVersion: users.acceptedTermsVersion,
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
    contestRegistrationPersonalData,
    contestAgreements,
  ] = await Promise.all([
    // Consent audit trail (G1: include the captured IP / user-agent)
    db.select({
      kind: userConsents.kind,
      version: userConsents.version,
      documentHash: userConsents.documentHash,
      ipAddress: userConsents.ipAddress,
      userAgent: userConsents.userAgent,
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

    // Contest personal data (the entrant's OWN partitioned entry PII)
    db.select({
      fields: contestEntryPrivateFields.fields,
      createdAt: contestEntryPrivateFields.createdAt,
    }).from(contestEntryPrivateFields).where(eq(contestEntryPrivateFields.userId, userId)),

    // Contest REGISTRATION personal data (the participant's OWN partitioned
    // registration-form PII; P1 sink, written from P2). Included here so a DSAR
    // export stays complete the moment registration PII starts being stored.
    db.select({
      fields: contestRegistrationPrivateFields.fields,
      createdAt: contestRegistrationPrivateFields.createdAt,
    }).from(contestRegistrationPrivateFields).where(eq(contestRegistrationPrivateFields.userId, userId)),

    // Contest agreement acceptances (the user's own consent snapshots; G1: incl. IP)
    db.select({
      fieldKey: contestAgreementAcceptances.fieldKey,
      termsSnapshot: contestAgreementAcceptances.termsSnapshot,
      termsHash: contestAgreementAcceptances.termsHash,
      ip: contestAgreementAcceptances.ip,
      acceptedAt: contestAgreementAcceptances.acceptedAt,
    }).from(contestAgreementAcceptances).where(eq(contestAgreementAcceptances.userId, userId)),
  ]);

  // GDPR round-6 completeness batch (session 231): authored/identifying subject
  // data omitted by the earlier batches. Scoped to the subject; rows that name a
  // third party are projected to the subject's own fields only.
  const [
    ownReferralLinks,
    ownReferralAttributions,
    authoredHubPosts,
    authoredHubPostReplies,
    authoredVideos,
    authoredLearningPaths,
    authoredProducts,
    ownedDocsSites,
    filedReports,
    hubFlagsRaised,
    earnedCertificates,
    uploadedFiles,
    authoredContentVersions,
  ] = await Promise.all([
    // Referral links the user created
    db.select({
      code: referralLinks.code,
      label: referralLinks.label,
      landingPath: referralLinks.landingPath,
      attributionWindowDays: referralLinks.attributionWindowDays,
      clickCount: referralLinks.clickCount,
      signupCount: referralLinks.signupCount,
      createdAt: referralLinks.createdAt,
    }).from(referralLinks).where(eq(referralLinks.ownerId, userId)),

    // The subject's OWN signup attribution (which link referred THEM). We do not
    // export the owner-side rows (people the subject referred) — those enumerate
    // third-party user ids. Only the code of the referring link is exposed.
    db.select({
      referringLinkCode: referralLinks.code,
      status: referralAttributions.status,
      confirmedAt: referralAttributions.confirmedAt,
      createdAt: referralAttributions.createdAt,
    }).from(referralAttributions)
      .innerJoin(referralLinks, eq(referralLinks.id, referralAttributions.referralLinkId))
      .where(eq(referralAttributions.referredUserId, userId)),

    // Hub forum posts authored by the user (their content, not the hub roster)
    db.select({
      hubSlug: hubs.slug,
      hubName: hubs.name,
      type: hubPosts.type,
      content: hubPosts.content,
      isPinned: hubPosts.isPinned,
      isLocked: hubPosts.isLocked,
      lastEditedAt: hubPosts.lastEditedAt,
      createdAt: hubPosts.createdAt,
      updatedAt: hubPosts.updatedAt,
    }).from(hubPosts)
      .innerJoin(hubs, eq(hubs.id, hubPosts.hubId))
      .where(eq(hubPosts.authorId, userId)),

    // Hub forum replies authored by the user
    db.select({
      postId: hubPostReplies.postId,
      content: hubPostReplies.content,
      createdAt: hubPostReplies.createdAt,
      updatedAt: hubPostReplies.updatedAt,
    }).from(hubPostReplies).where(eq(hubPostReplies.authorId, userId)),

    // Videos authored by the user
    db.select({
      title: videos.title,
      description: videos.description,
      url: videos.url,
      platform: videos.platform,
      duration: videos.duration,
      createdAt: videos.createdAt,
    }).from(videos).where(eq(videos.authorId, userId)),

    // Learning paths authored by the user (distinct from enrollments above)
    db.select({
      title: learningPaths.title,
      slug: learningPaths.slug,
      description: learningPaths.description,
      status: learningPaths.status,
      createdAt: learningPaths.createdAt,
    }).from(learningPaths).where(eq(learningPaths.authorId, userId)),

    // Products created by the user
    db.select({
      name: products.name,
      slug: products.slug,
      description: products.description,
      category: products.category,
      createdAt: products.createdAt,
    }).from(products).where(eq(products.createdById, userId)),

    // Docs sites owned by the user
    db.select({
      name: docsSites.name,
      slug: docsSites.slug,
      description: docsSites.description,
      createdAt: docsSites.createdAt,
    }).from(docsSites).where(eq(docsSites.ownerId, userId)),

    // Reports the user filed — the subject's OWN statement only. Deliberately
    // omit targetId / reviewedById / resolution: those identify or describe the
    // reported third party and the moderator, not the subject.
    db.select({
      targetType: reports.targetType,
      reason: reports.reason,
      description: reports.description,
      status: reports.status,
      createdAt: reports.createdAt,
    }).from(reports).where(eq(reports.reporterId, userId)),

    // Hub moderation flags the user raised — the subject's OWN statement only.
    // Omit targetId / resolvedById: they name the flagged party and the resolver.
    db.select({
      targetType: hubFlags.targetType,
      reason: hubFlags.reason,
      status: hubFlags.status,
      createdAt: hubFlags.createdAt,
    }).from(hubFlags).where(eq(hubFlags.flaggedById, userId)),

    // Certificates the user earned
    db.select({
      pathSlug: learningPaths.slug,
      pathTitle: learningPaths.title,
      verificationCode: certificates.verificationCode,
      certificateUrl: certificates.certificateUrl,
      issuedAt: certificates.issuedAt,
    }).from(certificates)
      .innerJoin(learningPaths, eq(learningPaths.id, certificates.pathId))
      .where(eq(certificates.userId, userId)),

    // Files the user uploaded (metadata)
    db.select({
      filename: files.filename,
      originalName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      purpose: files.purpose,
      publicUrl: files.publicUrl,
      createdAt: files.createdAt,
    }).from(files).where(eq(files.uploaderId, userId)),

    // Content version history authored by the user
    db.select({
      contentId: contentVersions.contentId,
      version: contentVersions.version,
      title: contentVersions.title,
      content: contentVersions.content,
      createdAt: contentVersions.createdAt,
    }).from(contentVersions).where(eq(contentVersions.createdById, userId)),
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
    contestRegistrationPersonalData: contestRegistrationPersonalData as Record<string, unknown>[],
    contestAgreements: contestAgreements as Record<string, unknown>[],
    referralLinks: ownReferralLinks as Record<string, unknown>[],
    referralAttributions: ownReferralAttributions as Record<string, unknown>[],
    hubPosts: authoredHubPosts as Record<string, unknown>[],
    hubPostReplies: authoredHubPostReplies as Record<string, unknown>[],
    videos: authoredVideos as Record<string, unknown>[],
    learningPathsAuthored: authoredLearningPaths as Record<string, unknown>[],
    products: authoredProducts as Record<string, unknown>[],
    docsSites: ownedDocsSites as Record<string, unknown>[],
    reports: filedReports as Record<string, unknown>[],
    hubFlags: hubFlagsRaised as Record<string, unknown>[],
    certificates: earnedCertificates as Record<string, unknown>[],
    files: uploadedFiles as Record<string, unknown>[],
    contentVersions: authoredContentVersions as Record<string, unknown>[],
  };
}
