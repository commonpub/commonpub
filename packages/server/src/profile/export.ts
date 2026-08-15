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
  contestRegistrations,
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
  userPersonaAnswers,
  userPersonaText,
  userPurposeConsents,
  disclosureEvents,
  userStatisticsObjections,
  userSharedLinks,
} from '@commonpub/schema';
import type { PersonaSection } from '@commonpub/persona';
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
  contestRegistrationAnswers: Array<Record<string, unknown>>;
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
  // Persona (session 255). Every persona table carrying `user_id` appears here,
  // and a parity guard asserts it, so a new persona table cannot be silently
  // omitted from a subject access request. `socialLinks` and `website` stay on
  // the profile section above: the normalization into a links table is deferred
  // (plan section 14.4), so removing them here would drop data that is still the
  // only home of the subject's links.
  personaAnswers: Array<Record<string, unknown>>;
  personaText: Array<Record<string, unknown>>;
  purposeConsents: Array<Record<string, unknown>>;
  /**
   * Who this instance disclosed the subject to, and when.
   *
   * This is the direct answer to the Art. 15(1)(c) question "who are the
   * recipients of my personal data", so it is the last section that should be
   * missing from a copy the subject can download. It carries the recipient id
   * rather than a resolved name on purpose: a recipient the operator has since
   * removed still has to appear, and the id is the durable fact.
   */
  disclosureEvents: Array<Record<string, unknown>>;
  /**
   * The subject's standing objection to being counted in instance statistics
   * (GDPR Art. 21), or an empty array when they have not objected.
   *
   * Row-present-means-objected, so the array is at most one row long and its
   * emptiness is itself the answer. It is exported because the record of a
   * subject exercising a right over their own data is personal data about
   * them: an Art. 15 copy that omitted it would not show that the instance
   * holds, and acts on, that decision.
   */
  statisticsObjections: Array<Record<string, unknown>>;
  /**
   * Which link platforms the subject has agreed may be sent to named
   * recipients, one row per platform. Row-present-means-shared, so an empty
   * array is a complete answer and means nothing is shared.
   */
  sharedLinks: Array<Record<string, unknown>>;
}

export interface UserDataExportOptions {
  /**
   * The instance's EFFECTIVE persona schema, after file/DB precedence.
   *
   * Used only to resolve labels. Every persona row is exported with its raw
   * `sectionKey`, `fieldKey` and stored `value` whether or not a label resolves
   * (plan section 6.11), so a retired or renamed field is never invisible in a
   * subject access request; passing the sections only adds the human-readable
   * side of each row.
   *
   * There is deliberately NO default. Defaulting to the built-in sections would
   * print a built-in label next to an operator's relabelled field, and a wrong
   * label in a legal record is worse than no label. The caller that can reach
   * the persona registry passes the resolved sections; a caller that cannot
   * passes nothing and gets raw keys.
   */
  personaSections?: readonly PersonaSection[];
}

interface PersonaFieldLabels {
  label: string;
  /** Option value to option label, for closed-vocabulary answers. */
  options: Map<string, string>;
}

/** sectionKey and fieldKey lookups built once per export. */
function indexPersonaLabels(sections: readonly PersonaSection[] | undefined): {
  sections: Map<string, string>;
  fields: Map<string, PersonaFieldLabels>;
} {
  const sectionLabels = new Map<string, string>();
  const fieldLabels = new Map<string, PersonaFieldLabels>();
  for (const section of sections ?? []) {
    sectionLabels.set(section.key, section.label);
    for (const field of section.fields) {
      fieldLabels.set(field.key, {
        label: field.label,
        options: new Map((field.options ?? []).map((o) => [o.value, o.label])),
      });
    }
  }
  return { sections: sectionLabels, fields: fieldLabels };
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
 * contest votes cast, reports + hub moderation flags the user raised (their
 * statement only), and the persona sections: closed-vocabulary answers, free
 * text, and the full purpose-consent history with the snapshot of what was
 * shown at each grant or withdrawal. It deliberately EXCLUDES
 * secrets (keypairs, sessions, accounts) and third-party-bearing tables
 * (audit_logs) — see the exclusion note at the top of this module. Rows that
 * name a third party are projected down to the subject's own fields.
 */
export async function exportUserData(
  db: DB,
  userId: string,
  opts: UserDataExportOptions = {},
): Promise<UserDataExport> {
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
    contestRegistrationAnswers,
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

    // Contest REGISTRATION public answers (the participant's own registration row:
    // tier + the public partition of their answers). Distinct from the PII sink above.
    db.select({
      tier: contestRegistrations.tier,
      fields: contestRegistrations.fields,
      registeredAt: contestRegistrations.createdAt,
    }).from(contestRegistrations).where(eq(contestRegistrations.userId, userId)),

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

    // Files the user uploaded (metadata). `id` is included so a file-type answer
    // elsewhere in the export (e.g. a contest registration's file field, stored as a
    // bare files.id) can be correlated back to the named upload here.
    db.select({
      id: files.id,
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

  // Persona batch (session 255). Every table here holds the subject's own rows
  // and names no third party. `purposeConsents` is the reason this feature writes no
  // `sharing:*` row into `user_consents` (plan section 14.4): this section is
  // strictly more informative than that audit row would have been, because it
  // carries the state, the scope digest and the snapshot of the exact copy the
  // user was shown, and it needs no ALTER on a live GDPR table.
  const [
    personaAnswerRows,
    personaTextRows,
    purposeConsentRows,
    disclosureEventRows,
    statisticsObjectionRows,
    sharedLinkRows,
  ] = await Promise.all([
    db.select({
      sectionKey: userPersonaAnswers.sectionKey,
      fieldKey: userPersonaAnswers.fieldKey,
      value: userPersonaAnswers.value,
      createdAt: userPersonaAnswers.createdAt,
    }).from(userPersonaAnswers).where(eq(userPersonaAnswers.userId, userId)),

    db.select({
      sectionKey: userPersonaText.sectionKey,
      fieldKey: userPersonaText.fieldKey,
      value: userPersonaText.value,
      createdAt: userPersonaText.createdAt,
      updatedAt: userPersonaText.updatedAt,
    }).from(userPersonaText).where(eq(userPersonaText.userId, userId)),

    // The FULL history, not just the current row: an Art. 15 request about
    // consent that showed only the latest state would hide every withdrawal.
    db.select({
      purpose: userPurposeConsents.purpose,
      state: userPurposeConsents.state,
      scopeDigest: userPurposeConsents.scopeDigest,
      scopeSnapshot: userPurposeConsents.scopeSnapshot,
      policyVersion: userPurposeConsents.policyVersion,
      source: userPurposeConsents.source,
      actedAt: userPurposeConsents.actedAt,
      supersededAt: userPurposeConsents.supersededAt,
      ipAddress: userPurposeConsents.ipAddress,
      userAgent: userPurposeConsents.userAgent,
    }).from(userPurposeConsents).where(eq(userPurposeConsents.userId, userId)),

    // Every disclosure made about this subject through the member visibility
    // directory. One row per (recipient, member) per response, so a repeat pull
    // shows as a repeat row and the count is the signal. Retained for
    // `dataSharing.disclosureRetentionYears`, so this section is bounded by the
    // same window the member sees on /settings/privacy, not by all time.
    db.select({
      recipientId: disclosureEvents.recipientId,
      purpose: disclosureEvents.purpose,
      scopeDigest: disclosureEvents.scopeDigest,
      disclosedAt: disclosureEvents.disclosedAt,
    }).from(disclosureEvents).where(eq(disclosureEvents.userId, userId)),

    // The Art. 21 objection. At most one row, and its ABSENCE is the answer
    // "you are counted", which is why the section is always present even when
    // it is empty: a missing key would read as "we hold nothing about this",
    // and what the instance actually holds is a decision the subject made.
    db.select({
      objectedAt: userStatisticsObjections.objectedAt,
    }).from(userStatisticsObjections).where(eq(userStatisticsObjections.userId, userId)),

    // Per-platform link sharing. One row per platform the subject turned on,
    // with the date they turned it on rather than the date of the last save.
    db.select({
      platform: userSharedLinks.platform,
      createdAt: userSharedLinks.createdAt,
    }).from(userSharedLinks).where(eq(userSharedLinks.userId, userId)),
  ]);

  // Label resolution. The raw keys are ALWAYS emitted and the label is `null`
  // when nothing resolves, so a field the operator retired or renamed still
  // appears with its stored value rather than vanishing from the export.
  const labels = indexPersonaLabels(opts.personaSections);
  const personaAnswerRowsLabelled = personaAnswerRows.map((r) => {
    const field = labels.fields.get(r.fieldKey);
    return {
      ...r,
      sectionLabel: labels.sections.get(r.sectionKey) ?? null,
      fieldLabel: field?.label ?? null,
      valueLabel: field?.options.get(r.value) ?? null,
    };
  });
  const personaTextRowsLabelled = personaTextRows.map((r) => ({
    ...r,
    sectionLabel: labels.sections.get(r.sectionKey) ?? null,
    fieldLabel: labels.fields.get(r.fieldKey)?.label ?? null,
  }));

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
    contestRegistrationAnswers: contestRegistrationAnswers as Record<string, unknown>[],
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
    personaAnswers: personaAnswerRowsLabelled as Record<string, unknown>[],
    personaText: personaTextRowsLabelled as Record<string, unknown>[],
    purposeConsents: purposeConsentRows as Record<string, unknown>[],
    disclosureEvents: disclosureEventRows as Record<string, unknown>[],
    statisticsObjections: statisticsObjectionRows as Record<string, unknown>[],
    sharedLinks: sharedLinkRows as Record<string, unknown>[],
  };
}
