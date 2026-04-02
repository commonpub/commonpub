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
} from './query.js';
export type { PaginationOpts } from './query.js';

// Content
export {
  listContent,
  getContentBySlug,
  createContent,
  updateContent,
  deleteContent,
  publishContent,
  incrementViewCount,
  onContentPublished,
  onContentUpdated,
  onContentDeleted,
  onContentStatusChange,
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
  followUser,
  unfollowUser,
  isFollowing,
  listFollowers,
  listFollowing,
  createReport,
  listUserBookmarks,
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
  reorderDocsPages,
  getDocsNav,
  updateDocsNav,
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
export { getUserByUsername, getUserContent, updateUserProfile } from './profile/index.js';

// Security
export {
  buildCspDirectives,
  buildCspHeader,
  getSecurityHeaders,
  getStaticCacheHeaders,
  generateNonce,
  RateLimitStore,
  DEFAULT_TIERS,
  getTierForPath,
  shouldSkipRateLimit,
  checkRateLimit,
} from './security.js';
export type { RateLimitTier, RateLimitResult } from './security.js';

// Theme
export { resolveTheme, getCustomTokenOverrides, setUserTheme } from './theme.js';

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
  type MirrorConfig,
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
  type AuthorizeResult,
  type TokenResult,
  type OAuthLoginState,
  type RemoteActorProfile,
  type FederatedContentItem,
  type FederatedTimelineOptions,
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
  deleteFederatedHubPost,
  likeFederatedHubPost,
  unlikeFederatedHubPost,
  backfillHubFromOutbox,
  fetchRemoteHubFollowers,
  repairFederatedHubPostActors,
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
} from './contest/index.js';
export type {
  ContestListItem,
  ContestDetail,
  ContestFilters,
  CreateContestInput,
  ContestEntryItem,
} from './contest/index.js';

// Notification
export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
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

// Email
export {
  SmtpEmailAdapter,
  ResendEmailAdapter,
  ConsoleEmailAdapter,
  emailTemplates,
} from './email.js';
export type { EmailAdapter, EmailMessage } from './email.js';
