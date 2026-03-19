import { submitContestEntry, getContestBySlug } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';
import { z } from 'zod';

const submitEntrySchema = z.object({
  contentId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<ContestEntryItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug required' });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const body = await readBody(event);

  const parsed = submitEntrySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return submitContestEntry(db, contest.id, parsed.data.contentId, user.id);
});
