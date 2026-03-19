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
export { generateSlug, ensureUniqueSlug, hasPermission, canManageRole } from './utils.js';

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
  createContentVersion,
  listContentVersions,
  forkContent,
  toggleBuildMark,
  isBuildMarked,
} from './content.js';
export type { ContentVersionItem } from './content.js';

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
  listPosts,
  deletePost,
  togglePinPost,
  toggleLockPost,
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
} from './hub.js';

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
} from './product.js';
export type {
  ProductListItem,
  ProductDetail,
  ContentProductItem,
  ProductFilters,
} from './product.js';

// Social
export {
  toggleLike,
  isLiked,
  listComments,
  createComment,
  deleteComment,
  toggleBookmark,
  onContentLiked,
  followUser,
  unfollowUser,
  isFollowing,
  listFollowers,
  listFollowing,
  createReport,
  listUserBookmarks,
} from './social.js';
export type { FollowUserItem, BookmarkItem } from './social.js';

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
} from './learning.js';

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
} from './docs.js';

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
} from './admin.js';
export type {
  AuditEntry,
  AuditLogItem,
  AuditFilters,
  PlatformStats,
  UserListItem,
  UserFilters,
  ReportListItem,
  ReportFilters,
} from './admin.js';

// Profile
export { getUserByUsername, getUserContent, updateUserProfile } from './profile.js';

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
  resolveRemoteActor,
  sendFollow,
  acceptFollow,
  rejectFollow,
  unfollowRemote,
  federateContent,
  federateUpdate,
  federateDelete,
  federateLike,
  getFollowers,
  getFollowing,
  listFederationActivity,
} from './federation.js';

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
} from './contest.js';
export type {
  ContestListItem,
  ContestDetail,
  ContestFilters,
  CreateContestInput,
  ContestEntryItem,
} from './contest.js';

// Notification
export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
} from './notification.js';
export type { NotificationItem, NotificationFilters } from './notification.js';

// Messaging
export {
  listConversations,
  getConversationMessages,
  createConversation,
  sendMessage,
  markMessagesRead,
} from './messaging.js';
export type { ConversationItem, MessageItem } from './messaging.js';

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
} from './video.js';
export type {
  VideoListItem,
  VideoDetail,
  VideoFilters,
  VideoCategoryItem,
} from './video.js';

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
  ConsoleEmailAdapter,
  emailTemplates,
} from './email.js';
export type { EmailAdapter, EmailMessage } from './email.js';
