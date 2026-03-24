import { listContestEntries, getContestBySlug } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';
import { z } from 'zod';

const entriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: ContestEntryItem[]; total: number }> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const query = parseQueryParams(event, entriesQuerySchema);
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  return listContestEntries(db, contest.id, query);
});
