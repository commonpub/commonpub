import { submitContestEntry, getContestBySlug, canViewContest } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';
import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
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
  // Can't enter a contest you can't see.
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }
  const input = await parseBody(event, submitEntrySchema);

  // Produce a SPECIFIC reason on failure (the old single catch-all 400 hid why
  // submission failed — most commonly the contest isn't active yet).
  if (contest.status !== 'active') {
    const detail = contest.status === 'upcoming'
      ? 'Entries open once the contest is active.'
      : contest.status === 'judging'
        ? 'Submissions are closed, the contest is being judged.'
        : `The contest is ${contest.status}.`;
    throw createError({ statusCode: 400, statusMessage: `This contest isn't accepting entries right now. ${detail}` });
  }
  const [content] = await db
    .select({ authorId: contentItems.authorId, status: contentItems.status, type: contentItems.type })
    .from(contentItems)
    .where(eq(contentItems.id, input.contentId))
    .limit(1);
  if (!content) throw createError({ statusCode: 400, statusMessage: 'That content no longer exists.' });
  if (content.authorId !== user.id) throw createError({ statusCode: 403, statusMessage: 'You can only submit your own content.' });
  if (content.status !== 'published') throw createError({ statusCode: 400, statusMessage: 'That project isn’t published yet, publish it first, then submit.' });
  const eligible = contest.eligibleContentTypes ?? null;
  if (eligible && eligible.length > 0 && !eligible.includes(content.type)) {
    throw createError({ statusCode: 400, statusMessage: `This contest only accepts: ${eligible.join(', ')}.` });
  }

  // submitContestEntry re-validates (defense in depth) + enforces the per-user
  // cap + dedupes; a null here means already-entered or over the entry limit.
  const entry = await submitContestEntry(db, contest.id, input.contentId, user.id);
  if (!entry) {
    throw createError({ statusCode: 400, statusMessage: 'Couldn’t submit, you may have already entered this project, or reached the contest’s entry limit.' });
  }
  return entry;
});
