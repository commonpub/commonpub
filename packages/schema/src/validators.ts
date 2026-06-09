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
  categoryId: z.string().uuid().optional(),
});
export type CreateContentInput = z.infer<typeof createContentSchema>;

export const updateContentSchema = createContentSchema.partial().omit({ type: true }).extend({
  status: contentStatusSchema.optional(),
});
export type UpdateContentInput = z.infer<typeof updateContentSchema>;

// --- Content Category validators ---

export const createContentCategorySchema = z.object({
  name: z.string().min(1).max(64),
  slug: slugSchema,
  description: z.string().max(255).optional(),
  color: z.string().max(32).optional(),
  icon: z.string().max(64).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isSystem: z.boolean().optional(),
});
export type CreateContentCategoryInput = z.infer<typeof createContentCategorySchema>;

export const updateContentCategorySchema = createContentCategorySchema.partial();
export type UpdateContentCategoryInput = z.infer<typeof updateContentCategorySchema>;

// --- Social validators ---

export const likeTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'comment',
  'post',
  'explainer',
  'video',
]);
export type LikeTargetType = z.infer<typeof likeTargetTypeSchema>;

export const commentTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'explainer',
  'post',
  'lesson',
  'video',
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

// --- Hub Resource validators ---

export const resourceCategorySchema = z.enum([
  'documentation', 'tools', 'tutorials', 'community', 'hardware', 'software', 'other',
]);
export type ResourceCategory = z.infer<typeof resourceCategorySchema>;

export const createHubResourceSchema = z.object({
  title: z.string().min(1).max(255),
  url: z.string().url().max(2048),
  description: z.string().max(2000).optional(),
  category: resourceCategorySchema.default('other'),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateHubResourceInput = z.infer<typeof createHubResourceSchema>;

export const updateHubResourceSchema = createHubResourceSchema.partial();
export type UpdateHubResourceInput = z.infer<typeof updateHubResourceSchema>;

export const reorderHubResourcesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export type ReorderHubResourcesInput = z.infer<typeof reorderHubResourcesSchema>;

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

export const contestPrizeSchema = z
  .object({
    place: z.number().int().positive().optional(),
    category: z.string().max(120).optional(),
    // Optional: a prize can be description-only (no forced 1st/2nd/3rd title).
    title: z.string().max(255).optional(),
    description: z.string().max(1000).optional(),
    value: z.string().max(128).optional(),
  })
  // Reject a completely empty prize — it must carry at least one meaningful
  // field so flexible (description-only / category-only / place-only) prizes
  // are allowed while blank rows are not.
  .refine(
    (p) =>
      !!(p.title?.trim() || p.description?.trim() || p.category?.trim() || (typeof p.place === 'number' && p.place > 0)),
    { message: 'A prize needs a title, description, category, or place.' },
  );
export type ContestPrize = z.infer<typeof contestPrizeSchema>;

export const contestJudgingCriterionSchema = z.object({
  label: z.string().min(1).max(120),
  weight: z.number().int().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
});
export type ContestJudgingCriterion = z.infer<typeof contestJudgingCriterionSchema>;

// Phase B1 — a single ordered stage of a contest's timeline (stored as a jsonb
// array on `contests.stages`). See ContestStage in @commonpub/schema contest.ts.
export const contestStageSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  kind: z.enum(['submission', 'review', 'interim', 'results', 'event', 'custom']),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  core: z.boolean().optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(255).optional(),
  url: optionalUrl(),
  // Per-round rubric (review stages). Reuses the contest-level criterion shape.
  criteria: z.array(contestJudgingCriterionSchema).max(20).optional(),
  // Review stages: how many advance out of this round (the Top-N cut).
  advanceCount: z.number().int().min(1).max(100000).optional(),
});
export type ContestStageInput = z.infer<typeof contestStageSchema>;

// Phase B2 — apply an advancement cut at a review stage (the Top-N cull).
export const contestAdvanceSchema = z
  .object({
    reviewStageId: z.string().min(1).max(64),
    mode: z.enum(['topN', 'manual']),
    topN: z.number().int().min(1).max(10000).optional(),
    advancedEntryIds: z.array(z.string().uuid()).max(10000).optional(),
  })
  .refine((d) => (d.mode === 'topN' ? typeof d.topN === 'number' : Array.isArray(d.advancedEntryIds)), {
    message: 'topN mode needs `topN`; manual mode needs `advancedEntryIds`.',
  });

export const createContestSchema = z
  .object({
    title: z.string().min(1).max(255),
    subheading: z.string().max(300).optional(),
    description: z.string().max(10000).optional(),
    rules: z.string().max(10000).optional(),
    prizesDescription: z.string().max(10000).optional(),
    bannerUrl: optionalUrl(),
    coverImageUrl: optionalUrl(),
    showPrizes: z.boolean().optional(),
    // Optional on create — server slugifies the title when omitted.
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only').max(255).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    judgingEndDate: z.string().datetime().optional(),
    prizes: z.array(contestPrizeSchema).max(50).optional(),
    judgingCriteria: z.array(contestJudgingCriterionSchema).max(20).optional(),
    // Phase B1 — explicit stage timeline. Omitted/empty ⇒ server synthesizes the
    // classic Submissions → Judging → Results flow.
    stages: z.array(contestStageSchema).max(20).optional(),
    currentStageId: z.string().max(64).optional(),
    // Seed-only: populates the contest_judges table. Judges are managed via the
    // dedicated /judges endpoints after creation.
    judges: z.array(z.string().uuid()).max(50).optional(),
    // Seed-only: populates the contest_stakeholders table (view-only reviewers).
    stakeholders: z.array(z.string().uuid()).max(100).optional(),
    communityVotingEnabled: z.boolean().optional(),
    judgingVisibility: z.enum(['public', 'judges-only', 'private']).optional(),
    eligibleContentTypes: z.array(z.string().max(40)).max(20).optional(),
    maxEntriesPerUser: z.number().int().positive().max(1000).optional(),
    visibility: z.enum(['public', 'unlisted', 'private']).optional(),
    visibleToRoles: z.array(z.enum(['member', 'pro', 'verified', 'staff', 'admin'])).max(5).optional(),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  })
  .refine((d) => !d.judgingEndDate || new Date(d.judgingEndDate) >= new Date(d.endDate), {
    message: 'Judging end date must be on or after the end date',
    path: ['judgingEndDate'],
  });
export type CreateContestInput = z.infer<typeof createContestSchema>;

// `.partial()` is unavailable on a refined object, so derive the update schema
// from the underlying shape and re-apply the cross-field date guards.
export const updateContestSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    subheading: z.string().max(300).optional(),
    description: z.string().max(10000).optional(),
    rules: z.string().max(10000).optional(),
    prizesDescription: z.string().max(10000).optional(),
    bannerUrl: optionalUrl(),
    coverImageUrl: optionalUrl(),
    showPrizes: z.boolean().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only').max(255).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    judgingEndDate: z.string().datetime().optional(),
    prizes: z.array(contestPrizeSchema).max(50).optional(),
    judgingCriteria: z.array(contestJudgingCriterionSchema).max(20).optional(),
    stages: z.array(contestStageSchema).max(20).optional(),
    currentStageId: z.string().max(64).optional(),
    communityVotingEnabled: z.boolean().optional(),
    judgingVisibility: z.enum(['public', 'judges-only', 'private']).optional(),
    eligibleContentTypes: z.array(z.string().max(40)).max(20).optional(),
    maxEntriesPerUser: z.number().int().positive().max(1000).optional(),
    visibility: z.enum(['public', 'unlisted', 'private']).optional(),
    visibleToRoles: z.array(z.enum(['member', 'pro', 'verified', 'staff', 'admin'])).max(5).optional(),
  })
  // `judges` + `stakeholders` are intentionally NOT updatable here — they are
  // managed via the dedicated /judges and /stakeholders endpoints.
  .refine((d) => !d.startDate || !d.endDate || new Date(d.endDate) > new Date(d.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });
export type UpdateContestInput = z.infer<typeof updateContestSchema>;

export const criterionScoreSchema = z
  .object({
    label: z.string().max(120),
    score: z.number().int().min(0),
    max: z.number().int().min(1).max(100),
  })
  .refine((c) => c.score <= c.max, { message: 'Criterion score cannot exceed its max', path: ['score'] });
export type CriterionScore = z.infer<typeof criterionScoreSchema>;

export const judgeEntrySchema = z
  .object({
    entryId: z.string().uuid(),
    // Either an overall 0–100 score, or a per-criterion breakdown (the overall is
    // then derived server-side as a normalized weighted sum).
    score: z.number().int().min(1).max(100).optional(),
    criteriaScores: z.array(criterionScoreSchema).min(1).max(20).optional(),
    feedback: z.string().max(2000).optional(),
  })
  .refine((d) => d.score !== undefined || (d.criteriaScores && d.criteriaScores.length > 0), {
    message: 'Provide an overall score or per-criterion scores',
    path: ['score'],
  });
export type JudgeEntryInput = z.infer<typeof judgeEntrySchema>;

export const contestTransitionSchema = z.object({
  status: z.enum(['draft', 'upcoming', 'active', 'paused', 'judging', 'completed', 'cancelled']),
});
export type ContestTransitionInput = z.infer<typeof contestTransitionSchema>;

export const contestStatusSchema = z.enum(['draft', 'upcoming', 'active', 'paused', 'judging', 'completed', 'cancelled']);
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
  sidebarLabel: z.string().max(128).optional(),
  description: z.string().max(2000).optional(),
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
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
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

export const mirrorRequestDirectionSchema = z.enum(['incoming', 'outgoing']);
export type MirrorRequestDirection = z.infer<typeof mirrorRequestDirectionSchema>;

export const mirrorRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type MirrorRequestStatus = z.infer<typeof mirrorRequestStatusSchema>;

/**
 * Body for approving an incoming mirror request — the approver's bounded depth + filters for the
 * pull mirror they create of the requester. All optional; absent depth = forward-only.
 */
export const approveMirrorRequestSchema = z.object({
  sinceDays: z.coerce.number().int().positive().max(3650).optional(),
  maxItems: z.coerce.number().int().positive().max(5000).optional(),
  filterContentTypes: z.array(z.string().max(64)).max(20).nullable().optional(),
  filterTags: z.array(z.string().max(64)).max(50).nullable().optional(),
});
export type ApproveMirrorRequestInput = z.infer<typeof approveMirrorRequestSchema>;

// --- Registry / instance directory (Phase 4) ---

export const registryInstanceStatusSchema = z.enum(['active', 'hidden', 'blocked']);
export type RegistryInstanceStatus = z.infer<typeof registryInstanceStatusSchema>;

export const registryInstanceQuerySchema = z.object({
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type RegistryInstanceQuery = z.infer<typeof registryInstanceQuerySchema>;

export const setRegistryInstanceStatusSchema = z.object({
  status: registryInstanceStatusSchema,
});

// --- Filter schemas ---

export const contentFiltersSchema = z.object({
  status: contentStatusSchema.optional(),
  type: contentTypeSchema.optional(),
  visibility: z.enum(['public', 'members', 'private']).optional(),
  authorId: z.string().uuid().optional(),
  followedBy: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
  editorial: z.coerce.boolean().optional(),
  categoryId: z.string().uuid().optional(),
  difficulty: difficultySchema.optional(),
  search: z.string().max(200).optional(),
  tag: z.string().max(64).optional(),
  sort: z.enum(['recent', 'popular', 'featured', 'editorial']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  // Keyset (cursor) pagination — opaque token from a prior response's `nextCursor`.
  // Its PRESENCE in the query (even empty, for the first page) opts a feed request into
  // keyset mode at the endpoint; absent → legacy offset pagination. See listContentKeyset.
  cursor: z.string().max(512).optional(),
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

// --- Public API keys ---

export const PUBLIC_API_SCOPES = [
  'read:content',
  'read:hubs',
  'read:users',
  'read:learn',
  'read:events',
  'read:contests',
  'read:videos',
  'read:docs',
  'read:tags',
  'read:search',
  'read:analytics',
  'read:federation',
  'read:instance',
  'read:*',
] as const;

export const publicApiScopeSchema = z.enum(PUBLIC_API_SCOPES);
export type PublicApiScope = z.infer<typeof publicApiScopeSchema>;

/**
 * CORS origin pattern for an API key's allow-list. The only wildcard
 * metacharacter is `*`. Accepts:
 *   *                        any origin (wildcard-all)
 *   localhost                shorthand for http(s)://localhost on any port
 *   https://app.example.com  exact origin
 *   http://localhost:*       any port on a host
 *   https://*.example.com    any subdomain
 *   *://localhost:*          any scheme + any port
 *
 * Only `http`/`https` (or `*`) schemes are accepted, so `javascript:` /
 * `data:` and other schemes are rejected (the URL-scheme refinement lesson —
 * Zod's `.url()` is too permissive and rejected `*`/`localhost` outright,
 * which is the bug this replaces). Matching lives in `@commonpub/server`'s
 * `matchOrigin`; this schema is the write-time gate.
 */
const ORIGIN_PATTERN =
  /^(?:\*|localhost|(?:https?|\*):\/\/(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d{1,5}|\*))?)$/i;

export const originPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((v) => ORIGIN_PATTERN.test(v), {
    message:
      'Must be "*", "localhost", or an origin like https://app.example.com. Wildcards (*) are allowed for scheme, subdomain, or port.',
  });

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  scopes: z.array(publicApiScopeSchema).min(1),
  expiresAt: z.coerce.date().optional().nullable(),
  rateLimitPerMinute: z.number().int().min(1).max(10_000).optional(),
  allowedOrigins: z.array(originPatternSchema).max(50).optional().nullable(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// --- Custom theme validators ---
// Custom themes are JSON-stored token maps that admins can author, import,
// export, and apply instance-wide. See docs/reference/theme-system.md.

/** Slug for a custom theme ID — kebab/snake, lowercase, used in data-theme attr. */
export const customThemeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Theme id must be alphanumeric with - or _');

/** Token name (without leading `--`). Permissive — we accept any kebab key
 *  so custom themes can introduce brand tokens (e.g. `deveco-portal-purple`)
 *  on top of the canonical TOKEN_NAMES list. */
export const themeTokenKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Token name must be alphanumeric with - or _');

/** Token value — any CSS value, length-capped to keep the JSON sane. */
export const themeTokenValueSchema = z.string().min(1).max(512);

export const themeTokenMapSchema = z.record(themeTokenKeySchema, themeTokenValueSchema);
export type ThemeTokenMap = z.infer<typeof themeTokenMapSchema>;

/**
 * The generator "recipe" — the small set of inputs the @commonpub/theme-studio
 * wizard edits. Persisted alongside a theme so the wizard can be reopened
 * with its controls restored. Mirrors `ThemeRecipe` in @commonpub/theme-studio;
 * kept here as a bounded zod shape (the package re-validates on read).
 */
export const themeRecipeSchema = z.object({
  mode: z.enum(['light', 'dark']),
  accent: z.string().min(1).max(32),
  secondary: z.string().min(1).max(32).optional(),
  scheme: z.enum(['analogous', 'complementary', 'triadic', 'split', 'tetradic', 'monochrome']),
  fonts: z.object({
    display: z.string().min(1).max(80),
    body: z.string().min(1).max(80),
    ui: z.string().min(1).max(80),
    code: z.string().min(1).max(80),
  }),
  baseSize: z.number().min(8).max(32),
  ratio: z.number().min(1).max(3),
  spaceBase: z.union([z.literal(4), z.literal(8)]),
  density: z.enum(['compact', 'balanced', 'spacious']),
  shapeRadius: z.number().min(0).max(64),
  borderWidth: z.number().min(0).max(8),
  shadowStyle: z.enum(['none', 'hard', 'soft', 'glow', 'layered', 'neumorphic']),
  motion: z.enum(['sharp', 'snappy', 'smooth']),
  texture: z.number().min(0).max(0.2).optional().default(0),
  neutralHue: z.number().min(0).max(360).optional(),
  neutralSat: z.number().min(0).max(100).optional(),
  /** The design-ethos preset the recipe started from (UI convenience). */
  archetype: z.string().max(64).optional(),
});
export type ThemeRecipeInput = z.infer<typeof themeRecipeSchema>;

export const customThemeSchema = z.object({
  id: customThemeIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  family: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  isDark: z.boolean(),
  /** Optional sibling theme ID in the same family for the opposite mode. */
  pairId: customThemeIdSchema.optional(),
  /** Theme this one inherits from (built-in CSS or another custom). */
  parentTheme: z.string().min(1).max(64).default('base'),
  tokens: themeTokenMapSchema.default({}),
  /** Generator recipe (theme-studio). Absent for hand-authored themes. */
  recipe: themeRecipeSchema.optional(),
  /** Google-Font families to load when this theme is active. */
  fonts: z.array(z.string().min(1).max(80)).max(8).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type CustomThemeInput = z.infer<typeof customThemeSchema>;

/** PUT body — accepts partial updates. */
export const customThemeUpdateSchema = customThemeSchema.partial().required({ id: true });

/** Exported theme file format. Version bumped when the schema breaks. */
export const themeExportSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  theme: customThemeSchema,
});
export type ThemeExport = z.infer<typeof themeExportSchema>;

// --- Layout engine validators (session 155+) ----------------------------
// Spec: docs/plans/layout-and-pages.md §3.3. Invariants enforced here:
//   - colSpan 1-12 per breakpoint
//   - sum of colSpans in a row ≤ 12 (validated at the row level)
//   - position numbers unique within each parent
//   - PageMeta required for scope: custom-page; optional for others

const slug64 = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Slug must be alphanumeric with - or _');

const colSpan = z.number().int().min(1).max(12);

/** Layout scope — one row per scope key. */
export const layoutScopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('route'),
    /** Existing file-routed page like '/', '/blog', '/hubs/[slug]'. */
    path: z.string().min(1).max(512),
  }),
  z.object({
    type: z.literal('virtual'),
    /** Pre-declared virtual surface: footer, 404, error. */
    key: z.enum(['__footer', '__not-found', '__error']),
  }),
  z.object({
    type: z.literal('custom-page'),
    /** Normalized path; conflict-checked against file routes at save. */
    path: z.string().min(1).max(512),
  }),
]);
export type LayoutScope = z.infer<typeof layoutScopeSchema>;

/** Per-page SEO + access metadata. Required for custom-page scope. */
export const pageMetaSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  // ogImage MUST be an http(s) URL. Zod's plain .url() accepts
  // javascript:, data:, blob:, file: etc — which would render into
  // the `<meta property="og:image">` content attribute and become a
  // downstream vector for social-media scrapers (the URL is also
  // sometimes fetched server-side by SSR proxies). Refining here
  // closes the entire surface at the validation layer. Session 160
  // audit P1. Protocol-relative `//` is rejected by Zod's url()
  // anyway (no scheme); document for clarity.
  ogImage: z.string().url().max(2048).refine(
    (v) => /^https?:\/\//i.test(v),
    { message: 'ogImage must be an http:// or https:// URL' },
  ).optional(),
  noindex: z.boolean().optional().default(false),
  ogType: z.enum(['website', 'article', 'profile']).optional().default('website'),
  /** Server-side render gate. 'public' = anyone, 'members' = authenticated, 'admin' = admin only. */
  access: z.enum(['public', 'members', 'admin']).optional().default('public'),
  /** Which page frame to use — declares the zones available. */
  frame: z
    .enum(['narrow', 'wide', 'two-column', 'three-column', 'sidebar-left', 'sidebar-right'])
    .optional()
    .default('wide'),
});
export type PageMetaInput = z.infer<typeof pageMetaSchema>;

/** Per-section conditional visibility. */
export const sectionVisibilitySchema = z.object({
  roles: z
    .array(z.enum(['anonymous', 'member', 'pro', 'verified', 'staff', 'admin']))
    .optional(),
  features: z.array(z.string().min(1).max(64)).optional(),
  /** Hide entirely below these breakpoints (orthogonal to responsive colSpan). */
  hideAt: z.array(z.enum(['sm', 'md', 'lg'])).optional(),
});
export type SectionVisibility = z.infer<typeof sectionVisibilitySchema>;

/** Responsive colSpan overrides — lg ↦ md ↦ sm ↦ base colSpan. */
export const sectionResponsiveSchema = z.object({
  sm: colSpan.optional(),
  md: colSpan.optional(),
  lg: colSpan.optional(),
});
export type SectionResponsive = z.infer<typeof sectionResponsiveSchema>;

/** A single section — placed in a row, occupies `colSpan` of 12. */
export const layoutSectionSchema = z.object({
  /** UUID. Server-generated on create; preserved across reorders. */
  id: z.string().uuid(),
  /** Order within row, 0-based; renumbered on save. */
  order: z.number().int().min(0),
  /** Registry slug — validated against SECTION_REGISTRY at the API layer. */
  type: slug64.max(128),
  /** Per-type config blob — validated against the section's own Zod schema at write. */
  config: z.record(z.string(), z.unknown()).default({}),
  colSpan: colSpan.default(12),
  responsive: sectionResponsiveSchema.optional(),
  enabled: z.boolean().default(true),
  visibility: sectionVisibilitySchema.optional(),
  /** Per-section-type config schema version; bumped when the type changes shape. */
  schemaVersion: z.number().int().min(1).default(1),
});
export type LayoutSectionInput = z.infer<typeof layoutSectionSchema>;

/** Row-level styling (gap, alignment, background, vertical padding). */
export const layoutRowConfigSchema = z.object({
  gap: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  align: z.enum(['start', 'center', 'stretch']).optional(),
  /** Token reference like 'var(--surface2)'. No literal hex/rgb (rule #3). */
  background: z.string().max(256).optional(),
  paddingY: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
});
export type LayoutRowConfig = z.infer<typeof layoutRowConfigSchema>;

/** A row groups sections horizontally; sum of colSpans must be ≤ 12. */
export const layoutRowSchema = z
  .object({
    id: z.string().uuid(),
    order: z.number().int().min(0),
    config: layoutRowConfigSchema.optional(),
    // Max 24 sections per row — comfortable headroom for the 12-col
    // grid (12 col / 1-col each = 12 sections natural max; 24 covers
    // multi-row stacking pre-row-split). Bounded to cap payload-bomb
    // DOS from a malicious admin sending 10k sections (audit P2).
    sections: z.array(layoutSectionSchema).max(24).default([]),
  })
  .refine(
    (row) => row.sections.reduce((sum, s) => sum + s.colSpan, 0) <= 12,
    { message: 'Sum of section colSpans in a row must be ≤ 12' },
  )
  .refine(
    (row) => new Set(row.sections.map((s) => s.order)).size === row.sections.length,
    { message: 'Section orders within a row must be unique' },
  );
export type LayoutRowInput = z.infer<typeof layoutRowSchema>;

/** A zone holds an ordered list of rows. */
export const layoutZoneSchema = z
  .object({
    zone: slug64,
    // Max 200 rows per zone — a complex marketing page rarely exceeds
    // 50; 200 is comfortable headroom. Caps payload-bomb DOS (audit P2).
    rows: z.array(layoutRowSchema).max(200).default([]),
  })
  .refine(
    (z) => new Set(z.rows.map((r) => r.order)).size === z.rows.length,
    { message: 'Row orders within a zone must be unique' },
  );
export type LayoutZoneInput = z.infer<typeof layoutZoneSchema>;

// Layout shape — base object kept .omit-able by deferring the cross-field
// refinements. Both `layoutSchema` and `layoutCreateSchema` inline the
// same two refines (kept short on purpose to avoid the Zod-v4 generics
// dance with a helper that the compiler can't infer through).
const layoutBaseObject = z.object({
  id: z.string().uuid().optional(),
  scope: layoutScopeSchema,
  name: z.string().min(1).max(256),
  pageMeta: pageMetaSchema.optional(),
  // Max 16 zones — covers narrow/wide/two-column/three-column/sidebar-*
  // frames + virtual zones (footer, not-found, error) + room for
  // operator-defined frames. Caps payload-bomb DOS (audit P2).
  zones: z.array(layoutZoneSchema).max(16).default([]),
  state: z.enum(['draft', 'published']).default('draft'),
  publishedVersionId: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/** The full layout payload (read-side — includes server fields). */
export const layoutSchema = layoutBaseObject
  .refine(
    (l) => l.scope.type !== 'custom-page' || l.pageMeta !== undefined,
    { message: 'pageMeta is required for custom-page scope', path: ['pageMeta'] },
  )
  .refine(
    (l) => new Set(l.zones.map((z) => z.zone)).size === l.zones.length,
    { message: 'Zone slugs must be unique within a layout' },
  );
export type LayoutInput = z.infer<typeof layoutSchema>;

/** Body shape for POST/PUT — server generates UUIDs + renumbers positions + sets timestamps. */
export const layoutCreateSchema = layoutBaseObject
  .omit({ id: true, createdAt: true, updatedAt: true, publishedVersionId: true })
  .refine(
    (l) => l.scope.type !== 'custom-page' || l.pageMeta !== undefined,
    { message: 'pageMeta is required for custom-page scope', path: ['pageMeta'] },
  )
  .refine(
    (l) => new Set(l.zones.map((z) => z.zone)).size === l.zones.length,
    { message: 'Zone slugs must be unique within a layout' },
  );
export type LayoutCreateInput = z.infer<typeof layoutCreateSchema>;
