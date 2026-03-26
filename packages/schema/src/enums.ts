import { pgEnum } from 'drizzle-orm/pg-core';

// --- Auth & Users ---
export const userRoleEnum = pgEnum('user_role', ['member', 'pro', 'verified', 'staff', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);
export const profileVisibilityEnum = pgEnum('profile_visibility', ['public', 'members', 'private']);

// --- Content ---
export const contentStatusEnum = pgEnum('content_status', ['draft', 'published', 'archived']);
export const contentTypeEnum = pgEnum('content_type', [
  'project',
  'article',
  'blog',
  'explainer',
]);
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
export const contentVisibilityEnum = pgEnum('content_visibility', ['public', 'members', 'private']);

// --- Social ---
export const likeTargetTypeEnum = pgEnum('like_target_type', [
  'project',
  'article',
  'blog',
  'explainer',
  'comment',
  'post',
]);
export const commentTargetTypeEnum = pgEnum('comment_target_type', [
  'project',
  'article',
  'blog',
  'explainer',
  'post',
  'lesson',
]);
export const bookmarkTargetTypeEnum = pgEnum('bookmark_target_type', [
  'project',
  'article',
  'blog',
  'explainer',
  'learning_path',
]);
export const reportTargetTypeEnum = pgEnum('report_target_type', [
  'project',
  'article',
  'blog',
  'post',
  'comment',
  'user',
  'explainer',
]);
export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'inappropriate',
  'copyright',
  'other',
]);
export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'reviewed',
  'resolved',
  'dismissed',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'like',
  'comment',
  'follow',
  'mention',
  'contest',
  'certificate',
  'hub',
  'system',
]);

// --- Hubs ---
export const hubTypeEnum = pgEnum('hub_type', ['community', 'product', 'company']);
export const hubPrivacyEnum = pgEnum('hub_privacy', ['public', 'unlisted', 'private']);
export const hubRoleEnum = pgEnum('hub_role', [
  'owner',
  'admin',
  'moderator',
  'member',
]);
export const hubJoinPolicyEnum = pgEnum('hub_join_policy', [
  'open',
  'approval',
  'invite',
]);
export const hubMemberStatusEnum = pgEnum('hub_member_status', ['pending', 'active']);
export const postTypeEnum = pgEnum('post_type', ['text', 'link', 'share', 'poll']);

// --- Products ---
export const productStatusEnum = pgEnum('product_status', ['active', 'discontinued', 'preview']);
export const productCategoryEnum = pgEnum('product_category', [
  'microcontroller',
  'sbc',
  'sensor',
  'actuator',
  'display',
  'communication',
  'power',
  'mechanical',
  'software',
  'tool',
  'other',
]);

// --- Learning ---
export const lessonTypeEnum = pgEnum('lesson_type', [
  'article',
  'video',
  'quiz',
  'project',
  'explainer',
]);

// --- Contest ---
export const contestStatusEnum = pgEnum('contest_status', [
  'upcoming',
  'active',
  'judging',
  'completed',
]);

// --- Video ---
export const videoPlatformEnum = pgEnum('video_platform', ['youtube', 'vimeo', 'other']);

// --- Files ---
export const filePurposeEnum = pgEnum('file_purpose', [
  'cover',
  'content',
  'avatar',
  'banner',
  'attachment',
]);

// --- Federation ---
export const activityDirectionEnum = pgEnum('activity_direction', ['inbound', 'outbound']);
export const activityStatusEnum = pgEnum('activity_status', [
  'pending',
  'delivered',
  'failed',
  'processed',
]);
export const followRelationshipStatusEnum = pgEnum('follow_relationship_status', [
  'pending',
  'accepted',
  'rejected',
]);
export const mirrorStatusEnum = pgEnum('mirror_status', [
  'pending',
  'active',
  'paused',
  'failed',
]);
export const mirrorDirectionEnum = pgEnum('mirror_direction', ['pull', 'push']);

// --- Tags ---
export const tagCategoryEnum = pgEnum('tag_category', [
  'platform',
  'language',
  'framework',
  'topic',
  'general',
]);
