import { listContests, toPublicContest, isPublicContest, type PublicContestRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['upcoming', 'active', 'judging', 'completed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:contests');
  requireFeature('contests');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const filters = parsed.data;
  const db = useDB();
  const config = useConfig();
  const result = await listContests(db, filters);
  const domain = config.instance.domain;
  const items = (result.items as unknown as PublicContestRow[])
    .filter(isPublicContest)
    .map((r) => toPublicContest(r, domain));
  return { items, total: result.total, limit: filters.limit, offset: filters.offset };
});
