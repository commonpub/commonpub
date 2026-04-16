import { setHomepageSections } from '@commonpub/server';
import { z } from 'zod';

const sectionConfigSchema = z.object({
  contentType: z.string().max(64).optional(),
  sort: z.enum(['popular', 'recent', 'featured', 'editorial']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  showEditorial: z.boolean().optional(),
  categorySlug: z.string().max(64).optional(),
  featureGate: z.string().max(64).optional(),
  variant: z.string().max(64).optional(),
  customTitle: z.string().max(255).optional(),
  customSubtitle: z.string().max(500).optional(),
  html: z.string().max(10000).optional(),
});

const sectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['hero', 'editorial', 'content-grid', 'content-carousel', 'contests', 'hubs', 'learning', 'stats', 'custom-html']),
  title: z.string().max(255).optional(),
  enabled: z.boolean(),
  order: z.number().int().min(0),
  config: sectionConfigSchema,
});

const updateSectionsSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(20),
});

/**
 * PUT /api/admin/homepage/sections
 * Save homepage section configuration.
 */
export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);
  const db = useDB();
  const body = await parseBody(event, updateSectionsSchema);

  // Validate unique IDs
  const ids = new Set<string>();
  for (const section of body.sections) {
    if (ids.has(section.id)) {
      throw createError({ statusCode: 400, statusMessage: `Duplicate section ID: ${section.id}` });
    }
    ids.add(section.id);
  }

  await setHomepageSections(db, body.sections, user.id, getRequestIP(event) ?? undefined);

  return { sections: body.sections, message: 'Homepage updated' };
});
