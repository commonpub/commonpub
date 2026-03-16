// Types
export type { DB } from './types.js';
export type {
  UserRef,
  UserProfile,
  ContentListItem,
  ContentDetail,
  ContentFilters,
  CreateContentInput,
  UpdateContentInput,
  CommunityListItem,
  CommunityDetail,
  CommunityFilters,
  CommunityMemberItem,
  CommunityPostItem,
  CommunityPostFilters,
  CommunityReplyItem,
  CommunityInviteItem,
  CommunityBanItem,
  CommentItem,
  LearningPathListItem,
  LearningPathDetail,
  LearningPathFilters,
  EnrollmentItem,
  CertificateItem,
} from './types.js';

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
} from './content.js';

// Community
export {
  listCommunities,
  getCommunityBySlug,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
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
} from './community.js';

// Social
export {
  toggleLike,
  isLiked,
  listComments,
  createComment,
  deleteComment,
  toggleBookmark,
  onContentLiked,
} from './social.js';

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
export { getUserByUsername, getUserContent } from './profile.js';

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
  incrementVideoViewCount,
} from './video.js';
export type {
  VideoListItem,
  VideoDetail,
  VideoFilters,
  VideoCategoryItem,
} from './video.js';
