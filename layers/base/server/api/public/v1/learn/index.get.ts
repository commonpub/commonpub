import { listPaths, toPublicLearningPath, type PublicLearningPathRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  authorId: z.string().uuid().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:learn');
  requireFeature('learning');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const filters = parsed.data;
  const db = useDB();
  const config = useConfig();
  const result = await listPaths(db, {
    status: 'published',
    authorId: filters.authorId,
    difficulty: filters.difficulty,
    limit: filters.limit,
    offset: filters.offset,
  });
  const domain = config.instance.domain;
  const items = (result.items as unknown as PublicLearningPathRow[]).map((r) => toPublicLearningPath(r, domain));
  return { items, total: result.total, limit: filters.limit, offset: filters.offset };
});
