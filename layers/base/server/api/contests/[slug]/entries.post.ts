import { submitContestEntry, getContestBySlug, canViewContest, getRegistrationTier } from '@commonpub/server';
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
  // Registration precondition (features.contestEntryRequiresRegistration, default ON).
  // The registration flow is where the contest's REQUIRED fields are enforced and its
  // agreements are recorded to the consent log; without this gate `submitContestEntry`
  // silently auto-registers the entrant as a counted `full` participant who accepted
  // nothing. A `reminders`-tier follower has accepted nothing either, so only `full`
  // passes. 403 (not 400): the request is well-formed, the actor lacks standing.
  if (useConfig().features.contestEntryRequiresRegistration !== false) {
    const tier = await getRegistrationTier(db, contest.id, user.id);
    if (tier !== 'full') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Register for this contest before submitting an entry.',
      });
    }
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
