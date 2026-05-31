import { listContestEntries, getContestBySlug, isContestJudge, shouldRevealScores, canViewContest } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';
import { z } from 'zod';

const entriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeJudgeScores: z.coerce.boolean().optional(),
  order: z.enum(['recent', 'rank']).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: ContestEntryItem[]; total: number }> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const query = parseQueryParams(event, entriesQuerySchema);
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  // A privileged viewer is the contest owner, an admin, or a panel judge.
  // Only privileged viewers may read per-judge scores + written feedback.
  // Aggregate score visibility additionally honours the contest's
  // judgingVisibility setting (public / judges-only / private).
  const user = getOptionalUser(event);
  // Don't leak a private contest's entries to viewers who can't see the contest.
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }
  let privileged = false;
  if (user) {
    privileged =
      user.id === contest.createdById ||
      hasPermission(event, 'contest.manage') ||
      (await isContestJudge(db, contest.id, user.id));
  }

  return listContestEntries(db, contest.id, {
    limit: query.limit,
    offset: query.offset,
    orderBy: query.order,
    includeJudgeScores: privileged && query.includeJudgeScores,
    revealScores: shouldRevealScores(contest.judgingVisibility, contest.status, privileged),
  });
});
