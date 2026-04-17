import { listVideos, toPublicVideo, isPublicVideo, type PublicVideoRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  categoryId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:videos');
  requireFeature('video');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const filters = parsed.data;
  const db = useDB();
  const config = useConfig();
  const result = await listVideos(db, filters);
  const domain = config.instance.domain;
  const items = (result.items as unknown as PublicVideoRow[])
    .filter(isPublicVideo)
    .map((r) => toPublicVideo(r, domain));
  return { items, total: result.total, limit: filters.limit, offset: filters.offset };
});
