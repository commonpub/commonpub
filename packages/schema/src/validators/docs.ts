import { z } from 'zod';

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
