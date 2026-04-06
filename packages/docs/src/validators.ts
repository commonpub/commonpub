import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createDocsSiteSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
});

export const updateDocsSiteSchema = createDocsSiteSchema.partial();

export const createDocsVersionSchema = z.object({
  siteId: z.string().uuid(),
  version: z.string().min(1).max(32),
  isDefault: z.boolean().optional(),
});

export const createDocsPageSchema = z.object({
  versionId: z.string().uuid(),
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.union([
    z.string(),
    z.array(z.array(z.unknown())),
  ]),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.string().uuid().optional(),
});

export const updateDocsPageSchema = createDocsPageSchema.omit({ versionId: true }).partial();

const navItemSchema: z.ZodType<{
  id: string;
  title: string;
  pageId?: string;
  children?: Array<{ id: string; title: string; pageId?: string; children?: unknown[] }>;
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    pageId: z.string().uuid().optional(),
    children: z.array(navItemSchema).optional(),
  }),
);

export const docsNavStructureSchema = z.array(navItemSchema);

export const updateDocsNavSchema = z.object({
  versionId: z.string().uuid(),
  structure: docsNavStructureSchema,
});
