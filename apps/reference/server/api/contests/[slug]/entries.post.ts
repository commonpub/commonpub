import { submitContestEntry, getContestBySlug } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';
import { z } from 'zod';

const submitEntrySchema = z.object({
  contentId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<ContestEntryItem> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const input = await parseBody(event, submitEntrySchema);

  const entry = await submitContestEntry(db, contest.id, input.contentId, user.id);
  if (!entry) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot submit entry. Contest may not be active, or content is not published or not owned by you.' });
  }
  return entry;
});
