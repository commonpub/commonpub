import { z } from 'zod';
import { optionalUrl } from './_shared.js';

// --- Content validators ---

export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

/** Content type enum — includes 'article' for DB/federation backwards compat (normalized to 'blog' at app layer) */
export const contentTypeSchema = z.enum(['project', 'article', 'blog', 'explainer']);
export type ContentType = z.infer<typeof contentTypeSchema>;

export const contentStatusSchema = z.enum(['draft', 'scheduled', 'published', 'archived']);
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
  // Optional custom URL slug. Accepted loosely and normalized server-side
  // (generateSlug) so free-text in the editor's slug field never 400s.
  slug: z.string().max(255).optional(),
  // When set with status='scheduled', the future publish time.
  scheduledAt: z.coerce.date().optional(),
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

// --- Content filters ---

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
