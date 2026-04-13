import { z } from 'zod';

/** Optional URL field that also accepts empty strings (treated as undefined) */
const optionalUrl = (maxLen?: number) => {
  const base = maxLen ? z.string().url().max(maxLen) : z.string().url();
  return z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    base.optional(),
  );
};

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
    github: optionalUrl(),
    twitter: optionalUrl(),
    linkedin: optionalUrl(),
    youtube: optionalUrl(),
    instagram: optionalUrl(),
    mastodon: optionalUrl(),
    discord: optionalUrl(),
  })
  .optional();

export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema.optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  headline: z.preprocess((v) => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(255).optional()),
  location: z.preprocess((v) => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(128).optional()),
  website: optionalUrl(512),
  avatarUrl: optionalUrl(2048),
  bannerUrl: optionalUrl(2048),
  socialLinks: socialLinksSchema,
  skills: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  experience: z.array(z.object({
    title: z.string().trim().min(1).max(128),
    company: z.string().trim().max(128),
    startDate: z.string().max(32),
    endDate: z.string().max(32),
    description: z.string().trim().max(2000),
  })).max(20).optional(),
  pronouns: z.preprocess((v) => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(32).optional()),
  timezone: z.string().max(64).optional(),
  emailNotifications: z
    .object({
      digest: z.enum(['daily', 'weekly', 'none']).optional(),
      likes: z.boolean().optional(),
      comments: z.boolean().optional(),
      follows: z.boolean().optional(),
      mentions: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// --- Content validators ---

export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

/** Content type enum — includes 'article' for DB/federation backwards compat (normalized to 'blog' at app layer) */
export const contentTypeSchema = z.enum(['project', 'article', 'blog', 'explainer']);
export type ContentType = z.infer<typeof contentTypeSchema>;

export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const createContentSchema = z.object({
  type: contentTypeSchema,
  title: z.string().min(1).max(255),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  content: z.unknown().optional(),
  coverImageUrl: optionalUrl(),
  bannerUrl: optionalUrl(),
  category: z.string().max(64).optional(),
  difficulty: difficultySchema.optional(),
  buildTime: z.string().max(64).optional(),
  estimatedCost: z.string().max(64).optional(),
  estimatedMinutes: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.number().int().positive().optional(),
  ),
  visibility: z.enum(['public', 'members', 'private']).optional(),
  seoDescription: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().max(320).optional(),
  ),
  licenseType: z.string().max(32).optional(),
  series: z.string().max(128).optional(),
  sections: z.unknown().optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});
export type CreateContentInput = z.infer<typeof createContentSchema>;

export const updateContentSchema = createContentSchema.partial().omit({ type: true }).extend({
  status: contentStatusSchema.optional(),
});
export type UpdateContentInput = z.infer<typeof updateContentSchema>;

// --- Social validators ---

export const likeTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'comment',
  'post',
  'explainer',
]);
export type LikeTargetType = z.infer<typeof likeTargetTypeSchema>;

export const commentTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'explainer',
  'post',
  'lesson',
]);
export type CommentTargetType = z.infer<typeof commentTargetTypeSchema>;

export const createCommentSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(10000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// --- Hub validators ---

export const hubTypeSchema = z.enum(['community', 'product', 'company']);
export type HubType = z.infer<typeof hubTypeSchema>;

export const createHubSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(2000).optional(),
  rules: z.string().max(10000).optional(),
  hubType: hubTypeSchema.default('community'),
  joinPolicy: z.enum(['open', 'approval', 'invite']).default('open'),
  privacy: z.enum(['public', 'unlisted', 'private']).default('public'),
  website: optionalUrl(512),
  iconUrl: optionalUrl(2048),
  bannerUrl: optionalUrl(2048),
  categories: z.array(z.string().max(64)).max(20).optional(),
  parentHubId: z.string().uuid().optional(),
});
export type CreateHubInput = z.infer<typeof createHubSchema>;

export const updateHubSchema = createHubSchema.partial();
export type UpdateHubInput = z.infer<typeof updateHubSchema>;

export const createPostSchema = z.object({
  hubId: z.string().uuid().optional(),
  type: z.enum(['text', 'link', 'share', 'poll', 'discussion', 'question', 'showcase', 'announcement']).default('text'),
  content: z.string().trim().min(1).max(10000),
  sharedContentId: z.string().uuid().optional(),
  pollOptions: z.array(z.string().min(1).max(200)).min(2).max(10).optional(),
  pollMultiSelect: z.boolean().optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createReplySchema = z.object({
  postId: z.string().uuid(),
  content: z.string().trim().min(1).max(10000),
  parentId: z.string().uuid().optional(),
});
export type CreateReplyInput = z.infer<typeof createReplySchema>;

export const editPostSchema = z.object({
  content: z.string().trim().min(1).max(10000),
});
export type EditPostInput = z.infer<typeof editPostSchema>;

export const createInviteSchema = z.object({
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const banUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
});
export type BanUserInput = z.infer<typeof banUserSchema>;

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'moderator', 'member']),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const postTypeSchema = z.enum(['text', 'link', 'share', 'poll', 'discussion', 'question', 'showcase', 'announcement']);
export type PostType = z.infer<typeof postTypeSchema>;

export const joinPolicySchema = z.enum(['open', 'approval', 'invite']);
export type JoinPolicy = z.infer<typeof joinPolicySchema>;

export const hubPrivacySchema = z.enum(['public', 'unlisted', 'private']);
export type HubPrivacy = z.infer<typeof hubPrivacySchema>;

export const hubRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member']);
export type HubRole = z.infer<typeof hubRoleSchema>;

// --- Product validators ---

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  category: z
    .enum([
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
    ])
    .optional(),
  specs: z.record(z.string(), z.string()).optional(),
  imageUrl: optionalUrl(),
  purchaseUrl: optionalUrl(),
  datasheetUrl: optionalUrl(),
  pricing: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().max(3).optional(),
    })
    .optional(),
  status: z.enum(['active', 'discontinued', 'preview']).default('active'),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addContentProductSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  role: z.string().max(64).optional(),
  notes: z.string().max(500).optional(),
  required: z.boolean().default(true),
});
export type AddContentProductInput = z.infer<typeof addContentProductSchema>;

export const productStatusSchema = z.enum(['active', 'discontinued', 'preview']);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productCategorySchema = z.enum([
  'microcontroller', 'sbc', 'sensor', 'actuator', 'display',
  'communication', 'power', 'mechanical', 'software', 'tool', 'other',
]);
export type ProductCategory = z.infer<typeof productCategorySchema>;

// --- Contest validators ---

export const createContestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  rules: z.string().max(10000).optional(),
  bannerUrl: optionalUrl(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  judgingEndDate: z.string().datetime().optional(),
  prizes: z
    .array(
      z.object({
        place: z.number().int().positive(),
        title: z.string().max(255),
        description: z.string().max(1000).optional(),
        value: z.string().max(128).optional(),
      }),
    )
    .optional(),
  judges: z.array(z.string().uuid()).optional(),
});
export type CreateContestInput = z.infer<typeof createContestSchema>;

export const updateContestSchema = createContestSchema.partial();
export type UpdateContestInput = z.infer<typeof updateContestSchema>;

export const judgeEntrySchema = z.object({
  entryId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  feedback: z.string().max(2000).optional(),
});
export type JudgeEntryInput = z.infer<typeof judgeEntrySchema>;

export const contestTransitionSchema = z.object({
  status: z.enum(['upcoming', 'active', 'judging', 'completed']),
});
export type ContestTransitionInput = z.infer<typeof contestTransitionSchema>;

export const contestStatusSchema = z.enum(['upcoming', 'active', 'judging', 'completed']);
export type ContestStatus = z.infer<typeof contestStatusSchema>;

// --- Video validators ---

export const createVideoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  url: z.string().url(),
  embedUrl: optionalUrl(),
  platform: z.enum(['youtube', 'vimeo', 'other']).default('other'),
  thumbnailUrl: optionalUrl(),
  duration: z.string().max(16).optional(),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const videoPlatformSchema = z.enum(['youtube', 'vimeo', 'other']);
export type VideoPlatform = z.infer<typeof videoPlatformSchema>;

export const createVideoCategorySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateVideoCategoryInput = z.infer<typeof createVideoCategorySchema>;

// --- Learning validators ---

export const createLearningPathSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  difficulty: difficultySchema.optional(),
  estimatedHours: z.number().positive().max(9999).optional(),
  coverImageUrl: optionalUrl(),
});
export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>;

export const updateLearningPathSchema = createLearningPathSchema.partial();
export type UpdateLearningPathInput = z.infer<typeof updateLearningPathSchema>;

export const createModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = createModuleSchema.partial();
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

export const lessonTypeSchema = z.enum(['article', 'video', 'quiz', 'project', 'explainer']);
export type LessonType = z.infer<typeof lessonTypeSchema>;

export const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  type: lessonTypeSchema,
  content: z.unknown().optional(),
  contentItemId: z.string().uuid().optional(),
  duration: z.number().int().positive().max(9999).optional(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = createLessonSchema.partial().omit({ moduleId: true }).extend({
  contentItemId: z.string().uuid().nullable().optional(),
});
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

// --- Messaging validators ---

export const createConversationSchema = z.object({
  participants: z.array(z.string().uuid()).min(1).max(50),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// --- Docs validators ---

export const createDocsSiteSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(2000).optional(),
});
export type CreateDocsSiteInput = z.infer<typeof createDocsSiteSchema>;

export const updateDocsSiteSchema = createDocsSiteSchema.partial();
export type UpdateDocsSiteInput = z.infer<typeof updateDocsSiteSchema>;

export const createDocsPageSchema = z.object({
  versionId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  slug: z.string().max(255).optional(),
  content: z.union([
    z.string(),
    z.array(z.array(z.unknown())),
  ]).default(''),
  status: z.enum(['draft', 'published']).default('draft').optional(),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.string().uuid().optional(),
});
export type CreateDocsPageInput = z.infer<typeof createDocsPageSchema>;

export const updateDocsPageSchema = createDocsPageSchema.partial();
export type UpdateDocsPageInput = z.infer<typeof updateDocsPageSchema>;

export const createDocsVersionSchema = z.object({
  version: z.string().min(1).max(32),
  isDefault: z.boolean().optional(),
  copyFromVersionId: z.string().uuid().optional(),
});
export type CreateDocsVersionInput = z.infer<typeof createDocsVersionSchema>;

// --- Report validators ---

export const createReportSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'post', 'comment', 'user', 'explainer']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'copyright', 'other']),
  description: z.string().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

// --- Admin validators ---

export const adminSettingSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.unknown(),
});
export type AdminSettingInput = z.infer<typeof adminSettingSchema>;

export const adminUpdateRoleSchema = z.object({
  role: z.enum(['member', 'pro', 'verified', 'staff', 'admin']),
});
export type AdminUpdateRoleInput = z.infer<typeof adminUpdateRoleSchema>;

export const adminUpdateStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deleted']),
});
export type AdminUpdateStatusInput = z.infer<typeof adminUpdateStatusSchema>;

export const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.string().min(1).max(2000),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

// --- Federation validators ---

export const actorUriSchema = z.string().url().max(2048);

export const activityDirectionSchema = z.enum(['inbound', 'outbound']);
export type ActivityDirection = z.infer<typeof activityDirectionSchema>;

export const activityStatusSchema = z.enum(['pending', 'delivered', 'failed', 'processed']);
export type ActivityStatus = z.infer<typeof activityStatusSchema>;

export const followRelationshipStatusSchema = z.enum(['pending', 'accepted', 'rejected']);
export type FollowRelationshipStatus = z.infer<typeof followRelationshipStatusSchema>;

export const createRemoteActorSchema = z.object({
  actorUri: actorUriSchema,
  inbox: z.string().url(),
  outbox: optionalUrl(),
  publicKeyPem: z.string().optional(),
  preferredUsername: z.string().max(64).optional(),
  displayName: z.string().max(128).optional(),
  avatarUrl: optionalUrl(),
  instanceDomain: z.string().min(1).max(255),
});
export type CreateRemoteActorInput = z.infer<typeof createRemoteActorSchema>;

export const createActivitySchema = z.object({
  type: z.string().min(1).max(64),
  actorUri: actorUriSchema,
  objectUri: actorUriSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
  direction: activityDirectionSchema,
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const createFollowRelationshipSchema = z.object({
  followerActorUri: actorUriSchema,
  followingActorUri: actorUriSchema,
});
export type CreateFollowRelationshipInput = z.infer<typeof createFollowRelationshipSchema>;

// --- Filter schemas ---

export const contentFiltersSchema = z.object({
  status: contentStatusSchema.optional(),
  type: contentTypeSchema.optional(),
  visibility: z.enum(['public', 'members', 'private']).optional(),
  authorId: z.string().uuid().optional(),
  followedBy: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
  difficulty: difficultySchema.optional(),
  search: z.string().max(200).optional(),
  tag: z.string().max(64).optional(),
  sort: z.enum(['recent', 'popular', 'featured']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ContentFilters = z.infer<typeof contentFiltersSchema>;

export const hubFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  joinPolicy: joinPolicySchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type HubFilters = z.infer<typeof hubFiltersSchema>;

export const learningPathFiltersSchema = z.object({
  status: contentStatusSchema.optional(),
  difficulty: difficultySchema.optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type LearningPathFilters = z.infer<typeof learningPathFiltersSchema>;

export const videoFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type VideoFilters = z.infer<typeof videoFiltersSchema>;

export const contestFiltersSchema = z.object({
  status: contestStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ContestFilters = z.infer<typeof contestFiltersSchema>;

export const hubPostFiltersSchema = z.object({
  hubId: z.string().uuid().optional(),
  type: postTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type HubPostFilters = z.infer<typeof hubPostFiltersSchema>;
