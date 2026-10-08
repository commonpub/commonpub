import { listContestEntries, getContestBySlug, getContestJudgeMembership, isContestEditor, shouldRevealScores, canViewContest } from '@commonpub/server';
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
  // Organizers: the owner, a contest.manage holder, or a per-contest editor. An
  // editor can run the advancement cut (advance.post.ts), so it must see what the
  // cut is made on: the full field and every judge's score.
  // Judges: ACCEPTED panel members only. A pending invitation used to count, so
  // a wrongly invited person could read every score without ever accepting.
  let organizer = false;
  let judge = false;
  if (user) {
    organizer =
      user.id === contest.createdById ||
      hasPermission(event, 'contest.manage') ||
      (await isContestEditor(db, contest.id, user.id));
    if (!organizer) {
      const membership = await getContestJudgeMembership(db, contest.id, user.id);
      judge = !!membership?.acceptedAt;
    }
  }
  const privileged = organizer || judge;

  // Per-stage artifacts ride along for privileged viewers (judge/owner views)
  // and for the entrant's OWN entries (pre-filling their submit form). Gated
  // by the contestStageSubmissions flag (rule #2).
  const config = useConfig();
  const artifactsOn = (config.features as unknown as Record<string, boolean>).contestStageSubmissions !== false;

  const revealScores = shouldRevealScores(contest.judgingVisibility, contest.status, privileged);
  // `order=rank` sorts by rank, then by the LIVE score. Blanking `score` in the
  // response doesn't hide the ORDER, so an anonymous `?order=rank` read the
  // judges' running standings mid-round (session 260). Before results, a viewer
  // who can't see scores can't sort by them either. Once completed, ranks are
  // public and the results page re-sorts by rank client-side anyway.
  const orderBy = query.order === 'rank' && !revealScores && contest.status !== 'completed' ? 'recent' : query.order;

  const result = await listContestEntries(db, contest.id, {
    limit: query.limit,
    offset: query.offset,
    orderBy,
    includeJudgeScores: privileged && query.includeJudgeScores,
    includeStageSubmissions: privileged && artifactsOn,
    stageSubmissionsViewerId: artifactsOn ? user?.id : undefined,
    // Non-privileged viewers don't see draft proposal placeholders (the public
    // entries list + their dead "View the project" link). The viewer still sees
    // their OWN draft entry so the submit-form gating (myEntries) stays correct.
    onlyPublishedContent: !privileged,
    viewerId: user?.id,
    revealScores,
  });

  // A judge sees their OWN scores and feedback, not the rest of the panel's:
  // seeing another judge's number before scoring anchors the judgement.
  if (judge && user) {
    for (const item of result.items) {
      if (item.judgeScores) item.judgeScores = item.judgeScores.filter((s) => s.judgeId === user.id);
    }
  }
  return result;
});
