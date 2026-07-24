import { z } from 'zod';
import { optionalUrl, httpUrl } from './_shared.js';

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
  role: z.enum(['admin', 'moderator', 'steward', 'member']),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

/** Owner-only: hand the `owner` role to another active member. */
export const transferOwnershipSchema = z.object({
  userId: z.string().uuid(),
});
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

/** Steward+ flags a shared project or a hub member for owner/admin review. */
export const createHubFlagSchema = z.object({
  targetType: z.enum(['project', 'member']),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
});
export type CreateHubFlagInput = z.infer<typeof createHubFlagSchema>;

/** Owner/admin resolves a flag. Does not itself remove the target. */
export const resolveHubFlagSchema = z.object({
  status: z.enum(['dismissed', 'actioned']),
});
export type ResolveHubFlagInput = z.infer<typeof resolveHubFlagSchema>;

export const postTypeSchema = z.enum(['text', 'link', 'share', 'poll', 'discussion', 'question', 'showcase', 'announcement']);
export type PostType = z.infer<typeof postTypeSchema>;

export const joinPolicySchema = z.enum(['open', 'approval', 'invite']);
export type JoinPolicy = z.infer<typeof joinPolicySchema>;

export const hubPrivacySchema = z.enum(['public', 'unlisted', 'private']);
export type HubPrivacy = z.infer<typeof hubPrivacySchema>;

export const hubRoleSchema = z.enum(['owner', 'admin', 'moderator', 'steward', 'member']);
export type HubRole = z.infer<typeof hubRoleSchema>;

// --- Hub Resource validators ---

export const resourceCategorySchema = z.enum([
  'documentation', 'tools', 'tutorials', 'community', 'hardware', 'software', 'other',
]);
export type ResourceCategory = z.infer<typeof resourceCategorySchema>;

export const createHubResourceSchema = z.object({
  title: z.string().min(1).max(255),
  url: httpUrl(2048),
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

// --- Hub filters ---

export const hubFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  joinPolicy: joinPolicySchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type HubFilters = z.infer<typeof hubFiltersSchema>;

export const hubPostFiltersSchema = z.object({
  hubId: z.string().uuid().optional(),
  type: postTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type HubPostFilters = z.infer<typeof hubPostFiltersSchema>;
