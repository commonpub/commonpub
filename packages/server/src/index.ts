// Hooks — consumer extension system
export { onHook, emitHook, clearHooks, hookCount } from './hooks.js';
export type { HookPayloads, HookEvent, HookHandler } from './hooks.js';

// Types
export type { DB, Serialized, PaginatedResponse } from './types.js';
export type {
  UserRef,
  UserProfile,
  ContentListItem,
  ContentDetail,
  ContentDetailAuthor,
  ContentRelatedItem,
  ContentFilters,
  HubListItem,
  HubDetail,
  HubFilters,
  HubMemberItem,
  HubPostItem,
  HubPostFilters,
  HubReplyItem,
  HubInviteItem,
  HubBanItem,
  FederatedHubListItem,
  FederatedHubPostItem,
  FederatedHubPostReplyItem,
  SharedContentMeta,
  CommentItem,
  LearningPathListItem,
  LearningPathDetail,
  LearningPathFilters,
  EnrollmentItem,
  CertificateItem,
} from './types.js';

// Re-export input types from schema (single source of truth)
export type {
  CreateContentInput,
  UpdateContentInput,
  CreateHubInput,
  UpdateHubInput,
  CreatePostInput,
  CreateReplyInput,
  CreateLearningPathInput,
  UpdateLearningPathInput,
  CreateModuleInput,
  CreateLessonInput,
  CreateDocsSiteInput,
  CreateDocsPageInput,
  CreateDocsVersionInput,
  CreateVideoInput,
  CreateProductInput,
  UpdateProductInput,
  CreateCommentInput,
  CreateReportInput,
  SendMessageInput,
  CreateConversationInput,
  BanUserInput,
  ChangeRoleInput,
  CreateInviteInput,
  AdminSettingInput,
  ContentType,
  ContentStatus,
  Difficulty,
  HubType,
  JoinPolicy,
  HubPrivacy,
  HubRole,
  PostType,
  LessonType,
  VideoPlatform,
  ContestStatus,
  CreateContentCategoryInput,
  UpdateContentCategoryInput,
} from '@commonpub/schema';

// Utilities
export { generateSlug, hasPermission, canManageRole } from './utils.js';

// Query Helpers
export {
  ensureUniqueSlugFor,
  USER_REF_SELECT,
  USER_REF_WITH_BIO_SELECT,
  USER_REF_WITH_HEADLINE_SELECT,
  normalizePagination,
  countRows,
  buildPartialUpdates,
  escapeLike,
  buildContentPath,
  buildContentUrl,
  buildContentEditPath,
  buildContentNewPath,
} from './query.js';
export type { PaginationOpts } from './query.js';

// Content
export {
  listContent,
  listContentKeyset,
  getContentBySlug,
  createContent,
  updateContent,
  deleteContent,
  publishContent,
  scheduleContent,
  publishDueScheduled,
  incrementViewCount,
  onContentPublished,
  onContentUpdated,
  onContentDeleted,
  createContentVersion,
  listContentVersions,
  forkContent,
  forkFederatedContent,
  toggleBuildMark,
  toggleFederatedBuildMark,
  isBuildMarked,
  isFederatedBuildMarked,
} from './content/index.js';
export type { ContentVersionItem } from './content/index.js';

// Content Categories
export {
  listContentCategories,
  getContentCategory,
  getContentCategoryBySlug,
  createContentCategory,
  updateContentCategory,
  deleteContentCategory,
} from './content/index.js';
export type { ContentCategoryItem } from './content/index.js';

// Hubs
export {
  listHubs,
  getHubBySlug,
  createHub,
  updateHub,
  deleteHub,
  joinHub,
  leaveHub,
  getMember,
  listMembers,
  listJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
  listRemoteMembers,
  changeRole,
  kickMember,
  createPost,
  editPost,
  listPosts,
  deletePost,
  togglePinPost,
  toggleLockPost,
  getPostById,
  likePost,
  unlikePost,
  hasLikedPost,
  createReply,
  listReplies,
  deleteReply,
  banUser,
  unbanUser,
  checkBan,
  listBans,
  createInvite,
  validateAndUseInvite,
  revokeInvite,
  listInvites,
  shareContent,
  unshareContent,
  listShares,
} from './hub/index.js';
export type { RemoteHubMember, HubResourceItem } from './hub/index.js';
export {
  listHubResources,
  createHubResource,
  updateHubResource,
  deleteHubResource,
  reorderHubResources,
} from './hub/index.js';

// Products
export {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductBySlug,
  listHubProducts,
  searchProducts,
  addContentProduct,
  removeContentProduct,
  listContentProducts,
  syncContentProducts,
  listProductContent,
  listHubGallery,
} from './product/index.js';
export type {
  ProductListItem,
  ProductDetail,
  ContentProductItem,
  ProductFilters,
} from './product/index.js';

// Social
export {
  toggleLike,
  isLiked,
isBookmarked,
  listComments,
  createComment,
  deleteComment,
  toggleBookmark,
  onContentLiked,
  onContentUnliked,
  onContentCommented,
  followUser,
  unfollowUser,
  isFollowing,
  listFollowers,
  listFollowing,
  createReport,
  listUserBookmarks,
  extractMentions,
  resolveUsernames,
} from './social/index.js';
export type { FollowUserItem, BookmarkItem } from './social/index.js';

// Learning
export {
  listPaths,
  getPathBySlug,
  createPath,
  updatePath,
  deletePath,
  publishPath,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  enroll,
  unenroll,
  markLessonComplete,
  getEnrollment,
  getUserEnrollments,
  getUserCertificates,
  getCertificateByCode,
  getLessonBySlug,
  getCompletedLessonIds,
} from './learning/index.js';

// Docs
export {
  listDocsSites,
  getDocsSiteBySlug,
  createDocsSite,
  updateDocsSite,
  deleteDocsSite,
  createDocsVersion,
  setDefaultVersion,
  deleteDocsVersion,
  listDocsPages,
  getDocsPage,
  createDocsPage,
  updateDocsPage,
  deleteDocsPage,
  duplicateDocsPage,
  reorderDocsPages,
  searchDocsPages,
} from './docs/index.js';

// Admin (includes audit)
export {
  createAuditEntry,
  listAuditLogs,
  getPlatformStats,
  listUsers,
  updateUserRole,
  updateUserStatus,
  listReports,
  resolveReport,
  getInstanceSettings,
  getInstanceSetting,
  setInstanceSetting,
  deleteUser,
  removeContent,
  removeFederatedContent,
} from './admin/index.js';
export type {
  AuditEntry,
  AuditLogItem,
  AuditFilters,
  PlatformStats,
  UserListItem,
  UserFilters,
  ReportListItem,
  ReportFilters,
} from './admin/index.js';

// Profile
export { getUserByUsername, getUserContent, updateUserProfile, exportUserData, searchUsers } from './profile/index.js';
export type { UserDataExport, UserSearchResult } from './profile/index.js';

// Security
export {
  buildCspDirectives,
  buildCspHeader,
  getSecurityHeaders,
  getStaticCacheHeaders,
  generateNonce,
  MemoryRateLimitStore,
  RateLimitStore,
  DEFAULT_TIERS,
  getTierForPath,
  shouldSkipRateLimit,
  checkRateLimit,
  getClientIp,
} from './security.js';
export type { RateLimitTier, RateLimitResult, GetClientIpOptions } from './security.js';

// Redis-backed scaling helpers (opt-in via NUXT_REDIS_URL)
export {
  createRateLimitStore,
  createRedisClient,
  createRealtimePubSub,
  createRedisFailOpenLogger,
} from '@commonpub/infra';
export type { RealtimePubSub, RedisClient, FailOpenHook } from '@commonpub/infra';

// Realtime pub/sub singleton for SSE fanout
export { publishSseEvent, subscribeSseEvents, realtimeChannel, resetRealtimeForTests } from './realtime/index.js';
export type { SseEventPayload } from './realtime/index.js';

// Theme
export {
  resolveTheme,
  getCustomTokenOverrides,
  setUserTheme,
  listCustomThemes,
  getCustomTheme,
  saveCustomTheme,
  deleteCustomTheme,
  customThemeDataAttr,
  parseCustomThemeId,
  CUSTOM_THEME_PREFIX,
} from './theme.js';
export type { CustomThemeRecord } from './theme.js';

// Layout engine (Phase 1 — session 157)
export {
  listLayouts,
  getLayoutByScope,
  getLayoutById,
  saveLayout,
  deleteLayout,
  publishLayout,
  listLayoutVersions,
  revertToVersion,
} from './layout/layout.js';
export type {
  LayoutScope,
  LayoutInput,
  LayoutRecord,
  LayoutZone,
  LayoutZoneInput,
  LayoutRowInput,
  LayoutRowResolved,
  LayoutSectionInput,
  LayoutSectionResolved,
  LayoutVersionRecord,
  LayoutPageMeta,
} from './layout/layout.js';

// Layout engine — homepage seed helper (Phase 1c — session 158)
export { seedHomepageLayout } from './layout/seed.js';
export type { SeedHomepageResult } from './layout/seed.js';

// Layout engine — legacy homepage migration (Phase 1c — session 159)
export { migrateHomepageSectionsToLayout } from './layout/migrate-homepage.js';
export type {
  MigrateHomepageResult,
  MigrateHomepageOptions,
  MigrateHomepageReason,
} from './layout/migrate-homepage.js';

// Layout engine — custom-page Phase 2 (path normalisation + scope validation)
export { pathNormalize, RESERVED_PREFIXES, RESERVED_EXACT } from './layout/path-normalize.js';
export type {
  NormalisePathResult,
  NormalisePathRejection,
} from './layout/path-normalize.js';
export { validateCustomPageScope, FILE_ROUTE_PREFIXES } from './layout/custom-page-validate.js';
export type {
  CustomPageValidateResult,
  CustomPageRejectReason,
  ValidateCustomPageOptions,
} from './layout/custom-page-validate.js';

// Federation
export {
  getOrCreateActorKeypair,
  getOrCreateInstanceKeypair,
  buildInstanceActor,
  resolveRemoteActor,
  searchRemoteActor,
  getRemoteActorProfile,
  sendFollow,
  acceptFollow,
  rejectFollow,
  unfollowRemote,
  federateContent,
  federateUpdate,
  federateDelete,
  federateLike,
  federateUnlike,
  buildContentUri,
  resolveContentObjectUri,
  getContentSlugById,
  getFollowers,
  getFollowing,
  listFederationActivity,
  createInboxHandlers,
  deliverPendingActivities,
  listFederatedTimeline,
  getFederatedContent,
  likeRemoteContent,
  boostRemoteContent,
  federateReply,
  listRemoteReplies,
  incrementFederatedViewCount,
  searchFederatedContent,
  getHubActorUri,
  getOrCreateHubKeypair,
  buildHubGroupActor,
  handleHubFollow,
  handleHubUnfollow,
  getHubFederatedFollowers,
  federateHubActor,
  federateHubPost,
  federateHubShare,
  federateHubPostDelete,
  federateHubPostUpdate,
  federateHubPostLike,
  federateHubPostUnlike,
  federateHubPostReply,
  federateHubUpdate,
  sendPostToRemoteHub,
  getHubPostNoteUri,
  createMirror,
  activateMirror,
  pauseMirror,
  resumeMirror,
  cancelMirror,
  listMirrors,
  getMirror,
  listInstanceFollowers,
  requestMirror,
  listMirrorRequests,
  getMirrorRequest,
  approveMirrorRequest,
  rejectMirrorRequest,
  fetchInstanceNodeInfo,
  recordRegistryPing,
  listRegistryInstances,
  getRegistryInstance,
  setRegistryInstanceStatus,
  sendRegistryPing,
  type MirrorConfig,
  type InstanceFollower,
  type MirrorRequestConfig,
  type RegistryInstanceView,
  type PulledNodeInfo,
  processAuthorize,
  processTokenExchange,
  registerOAuthClient,
  linkFederatedAccount,
  findUserByFederatedAccount,
  listOAuthClients,
  resolveRemoteHandle,
  federateDirectMessage,
  isFederatedHandle,
  processDynamicRegistration,
  storeOAuthState,
  consumeOAuthState,
  exchangeCodeForToken,
  createFederatedSession,
  storePendingLink,
  consumePendingLink,
  getStoredTrustedInstances,
  addTrustedInstance,
  removeTrustedInstance,
  isDomainTrusted,
  type AuthorizeResult,
  type TokenResult,
  type OAuthLoginState,
  type FederatedSessionResult,
  type PendingLinkData,
  type RemoteActorProfile,
  type FederatedContentItem,
  type FederatedTimelineOptions,
  repairFederatedContentTypes,
  type InboxHandlerOptions,
  type DeliveryResult,
  type DeliveryOptions,
  cleanupDeliveredActivities,
  backfillFromOutbox,
  type BackfillResult,
  countOutboxItems,
  countInstanceOutboxItems,
  getOutboxPage,
  getInstanceOutboxPage,
  countHubOutboxItems,
  getHubOutboxPage,
  isCircuitOpen,
  recordDeliverySuccess,
  recordDeliveryFailure,
  getDeliveryHealth,
  // Hub mirroring
  listFederatedHubs,
  getFederatedHub,
  getFederatedHubByActorUri,
  followRemoteHub,
  sendHubFollow,
  acceptHubFollow,
  unfollowRemoteHub,
  autoDiscoverHub,
  ingestFederatedHubPost,
  getFederatedHubPost,
  listFederatedHubPosts,
  listFederatedHubMembers,
  upsertFederatedHubMember,
  deleteFederatedHubPost,
  likeFederatedHubPost,
  unlikeFederatedHubPost,
  createFederatedHubPostReply,
  listFederatedHubPostReplies,
  backfillHubFromOutbox,
  fetchRemoteHubFollowers,
  repairFederatedHubPostActors,
  refreshFederatedHubMetadata,
  toggleFederatedHubPostLike,
  joinFederatedHub,
  getFederatedHubFollowStatus,
  getLikedFederatedHubPostIds,
  createSafeActorFetchFn,
  recordActivitySeen,
} from './federation/index.js';

// OAuth Codes
export { storeAuthCode, consumeAuthCode, cleanupExpiredCodes } from './oauthCodes.js';

// Contest
export {
  listContests,
  getContestBySlug,
  createContest,
  updateContest,
  listContestEntries,
  submitContestEntry,
  judgeContestEntry,
  deleteContest,
  transitionContestStatus,
  calculateContestRanks,
  withdrawContestEntry,
  shouldRevealScores,
  canViewContest,
  advanceContestStage,
  isEliminated,
  getContestEntry,
  submitStageArtifact,
  validateStageArtifactFields,
  validateSubmissionFields,
  recordPrivateAndAgreements,
  hashTerms,
  submitContestProposal,
  getEntryPrivateData,
  buildContestExport,
  toCsv,
} from './contest/index.js';
export type {
  ContestListItem,
  ContestDetail,
  ContestFilters,
  CreateContestInput,
  ContestEntryItem,
  ContestPrize,
  ContestJudgingCriterion,
  ContestJudgingVisibility,
  ContestVisibility,
  CriterionScore,
  JudgeScoreEntry,
  PartitionedSubmission,
  AgreementAcceptanceInput,
  SubmitProposalArgs,
  SubmitProposalResult,
  EntryPrivateData,
  ContestExport,
} from './contest/index.js';
export {
  listContestJudges,
  addContestJudge,
  removeContestJudge,
  updateJudgeRole,
  acceptJudgeInvite,
  isContestJudge,
} from './contest/judges.js';
export type {
  JudgeRole,
  ContestJudgeItem,
} from './contest/judges.js';
export {
  listContestStakeholders,
  addContestStakeholder,
  removeContestStakeholder,
  isContestStakeholder,
  isContestEditor,
} from './contest/index.js';
export type { ContestStakeholderItem } from './contest/index.js';

// Notification
export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
  shouldEmailNotification,
  getNotificationEmailTarget,
  setNotificationEmailSender,
} from './notification/index.js';
export type { NotificationItem, NotificationFilters, NotificationType } from './notification/index.js';

// Messaging
export {
  listConversations,
  getConversationMessages,
  createConversation,
  findOrCreateConversation,
  sendMessage,
  markMessagesRead,
  getUnreadMessageCount,
  getConversationUnreadCounts,
} from './messaging/index.js';
export type { ConversationItem, MessageItem } from './messaging/index.js';

// Video
export {
  listVideos,
  getVideoById,
  createVideo,
  listVideoCategories,
  createVideoCategory,
  updateVideoCategory,
  deleteVideoCategory,
  incrementVideoViewCount,
} from './video/index.js';
export type {
  VideoListItem,
  VideoDetail,
  VideoFilters,
  VideoCategoryItem,
} from './video/index.js';

// Auth
export { resolveIdentityToEmail } from './auth/index.js';

// Storage
export {
  LocalStorageAdapter,
  S3StorageAdapter,
  createStorageFromEnv,
  generateStorageKey,
  validateUpload,
  isProcessableImage,
  ALLOWED_MIME_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_SIZES,
} from './storage.js';
export type { StorageAdapter } from './storage.js';

// Image Processing
export {
  processImage,
  getBestVariant,
  IMAGE_VARIANTS,
} from './image.js';
export type { ProcessedImage, ImageVariant, ImageVariantName } from './image.js';

// Homepage
export {
  getHomepageSections,
  setHomepageSections,
  resetHomepageSections,
  DEFAULT_SECTIONS,
} from './homepage/homepage.js';
export type { HomepageSection, HomepageSectionConfig } from './homepage/homepage.js';

// Events
export {
  listEvents,
  getEventBySlug,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventAttendees,
  rsvpEvent,
  cancelRsvp,
  getUserRsvpStatus,
} from './events/events.js';
export type {
  EventListItem,
  EventDetail,
  EventFilters,
  CreateEventInput,
  UpdateEventInput,
  AttendeeItem,
  EventStatus,
  EventType,
  AttendeeStatus,
} from './events/events.js';

// Voting
export {
  voteOnPost,
  getUserPostVote,
  createPollOptions,
  getPollOptions,
  voteOnPoll,
  getUserPollVote,
  voteOnContestEntry,
  removeContestEntryVote,
  getContestEntryVoteCount,
  hasVotedOnContestEntry,
  getContestEntryVotes,
} from './voting/voting.js';
export type {
  VoteDirection,
  VoteResult,
  PollOptionResult,
  ContestEntryVoteInfo,
} from './voting/voting.js';

// Navigation
export {
  getNavItems,
  setNavItems,
  resetNavItems,
  DEFAULT_NAV_ITEMS,
} from './navigation/navigation.js';
export type { NavItem } from './navigation/navigation.js';

// Search
export {
  searchContent,
  searchWithMeilisearch,
  searchWithPostgres,
  indexContent,
  removeFromIndex,
  configureContentIndex,
} from './search/contentSearch.js';
export type {
  ContentSearchResult,
  ContentSearchOptions,
  MeiliClient,
} from './search/contentSearch.js';

// Import
export { importFromUrl } from './import/index.js';
export type { ImportResult } from './import/index.js';
export { isPrivateUrl, safeFetch, safeFetchBinary, safeFetchResponse, safeFetchSigned } from './import/ssrf.js';
export type { SafeFetchOptions, SafeFetchResponseResult } from './import/ssrf.js';

// Email
export {
  SmtpEmailAdapter,
  ResendEmailAdapter,
  ConsoleEmailAdapter,
  emailTemplates,
} from './email.js';
export type { EmailAdapter, EmailMessage } from './email.js';

// Public API (admin-scoped Bearer keys for external consumers)
export * from './publicApi/index.js';

// Global RBAC — role/permission resolution core (session 175)
export * from './rbac/index.js';

// Cross-instance identity — Phase 1a foundation. ActionRoute + run()
// are the gateway for delegated authorization; FediClient is the
// opaque facade for calling remote Fediverse instances. Phase 1b
// registers a real factory via setFediClientFactory; Phase 3 lands
// the runtime resolver; Phase 4 adds per-action declarations.
// See docs/sessions/136-cross-instance-identity-plan.md.
export type {
  ActionRoute,
  FediClient,
  VerifiedAccount,
  FediClientFactory,
  IdentityConfigCheckResult,
} from './identity/index.js';
export {
  run,
  getFediClient,
  setFediClientFactory,
  ActionUnavailable,
  InsufficientScopes,
  LinkedIdentityRevoked,
  checkIdentityConfig,
  assertIdentityConfig,
  createMastodonFediClientFactory,
} from './identity/index.js';

// Federated-account grant management (Phase 1b data layer)
export type { FederatedAccountGrant } from './federation/oauth.js';
export {
  getDecryptedAccessToken,
  revokeFederatedAccountGrant,
} from './federation/oauth.js';

// Mastodon-login flow (Phase 2a — server-side OAuth client of any
// Mastodon-API-compatible remote instance)
export type {
  RemoteClientCredentials,
  MastodonLoginState,
  VerifiedRemoteAccount,
} from './federation/mastodonLogin.js';
export {
  isValidHost,
  getOrRegisterRemoteClient,
  buildAuthorizeUrl,
  storeMastodonLoginState,
  consumeMastodonLoginState,
  detectSoftwareKind,
  exchangeCodeAndVerify,
} from './federation/mastodonLogin.js';
