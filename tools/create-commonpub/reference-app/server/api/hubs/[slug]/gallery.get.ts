import { getHubBySlug, listHubGallery } from '@commonpub/server';
import { z } from 'zod';

const galleryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const query = parseQueryParams(event, galleryQuerySchema);


  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return listHubGallery(db, hub.id, query);
});
