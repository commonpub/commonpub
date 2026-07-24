import { z } from 'zod';
import { optionalUrl, httpUrl } from './_shared.js';

// --- Video validators ---

export const createVideoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  url: httpUrl(),
  embedUrl: optionalUrl(),
  platform: z.enum(['youtube', 'vimeo', 'other']).default('other'),
  thumbnailUrl: optionalUrl(),
  duration: z.string().max(16).optional(),
  categoryId: z.string().uuid().optional(),
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

// --- Video filters ---

export const videoFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  sort: z.enum(['recent', 'viewed', 'liked']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type VideoFilters = z.infer<typeof videoFiltersSchema>;
