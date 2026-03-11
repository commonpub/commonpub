import { z } from 'zod';

// --- Auth validators ---

export const usernameSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, hyphens, and underscores',
  );

export const emailSchema = z.string().email().max(255);

export const displayNameSchema = z.string().min(1).max(128);

export const bioSchema = z.string().max(2000).optional();

export const socialLinksSchema = z
  .object({
    github: z.string().url().optional(),
    twitter: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    youtube: z.string().url().optional(),
    instagram: z.string().url().optional(),
    mastodon: z.string().url().optional(),
    discord: z.string().optional(),
  })
  .optional();

export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema.optional(),
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  headline: z.string().max(255).optional(),
  location: z.string().max(128).optional(),
  website: z.string().url().max(512).optional(),
  socialLinks: socialLinksSchema,
  skills: z.array(z.string().max(64)).max(50).optional(),
});

// --- Content validators ---

export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const contentTypeSchema = z.enum(['project', 'article', 'guide', 'blog', 'explainer']);

export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const createContentSchema = z.object({
  type: contentTypeSchema,
  title: z.string().min(1).max(255),
  slug: slugSchema,
  subtitle: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  content: z.unknown().optional(),
  coverImageUrl: z.string().url().optional(),
  category: z.string().max(64).optional(),
  difficulty: difficultySchema.optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

export const updateContentSchema = createContentSchema.partial().omit({ type: true });

// --- Social validators ---

export const likeTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'comment',
  'post',
  'explainer',
  'guide',
]);
export const commentTargetTypeSchema = z.enum(['project', 'article', 'blog', 'explainer', 'post', 'lesson']);

export const createCommentSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(1).max(10000),
});

// --- Community validators ---

export const createCommunitySchema = z.object({
  name: z.string().min(1).max(128),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  rules: z.string().max(10000).optional(),
  joinPolicy: z.enum(['open', 'approval', 'invite']).default('open'),
});

export const createPostSchema = z.object({
  communityId: z.string().uuid(),
  type: z.enum(['text', 'link', 'share', 'poll']).default('text'),
  content: z.string().min(1).max(10000),
  sharedContentId: z.string().uuid().optional(),
  pollOptions: z.array(z.string().min(1).max(200)).min(2).max(10).optional(),
  pollMultiSelect: z.boolean().optional(),
});

// --- Learning validators ---

export const createLearningPathSchema = z.object({
  title: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  difficulty: difficultySchema.optional(),
  estimatedHours: z.number().positive().max(9999).optional(),
});

export const lessonTypeSchema = z.enum(['article', 'video', 'quiz', 'project', 'explainer']);

export const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  slug: slugSchema,
  type: lessonTypeSchema,
  content: z.unknown().optional(),
  durationMinutes: z.number().int().positive().max(9999).optional(),
});

// --- Federation validators ---

export const actorUriSchema = z.string().url().max(2048);

export const activityDirectionSchema = z.enum(['inbound', 'outbound']);
export const activityStatusSchema = z.enum(['pending', 'delivered', 'failed', 'processed']);
export const followRelationshipStatusSchema = z.enum(['pending', 'accepted', 'rejected']);

export const createRemoteActorSchema = z.object({
  actorUri: actorUriSchema,
  inbox: z.string().url(),
  outbox: z.string().url().optional(),
  publicKeyPem: z.string().optional(),
  preferredUsername: z.string().max(64).optional(),
  displayName: z.string().max(128).optional(),
  avatarUrl: z.string().url().optional(),
  instanceDomain: z.string().min(1).max(255),
});

export const createActivitySchema = z.object({
  type: z.string().min(1).max(64),
  actorUri: actorUriSchema,
  objectUri: actorUriSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
  direction: activityDirectionSchema,
});

export const createFollowRelationshipSchema = z.object({
  followerActorUri: actorUriSchema,
  followingActorUri: actorUriSchema,
});

// --- Docs validators ---

export const createDocsSiteSchema = z.object({
  name: z.string().min(1).max(128),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
});

export const createDocsPageSchema = z.object({
  versionId: z.string().uuid(),
  title: z.string().min(1).max(255),
  slug: slugSchema,
  content: z.string(),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.string().uuid().optional(),
});

// --- Report validators ---

export const createReportSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'post', 'comment', 'user', 'explainer']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'copyright', 'other']),
  description: z.string().max(2000).optional(),
});

// --- Admin validators ---

export const updateInstanceSettingSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.unknown(),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['member', 'pro', 'verified', 'staff', 'admin']),
});

export const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['active', 'suspended', 'deleted']),
});

export const resolveReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.string().min(1).max(2000),
});
