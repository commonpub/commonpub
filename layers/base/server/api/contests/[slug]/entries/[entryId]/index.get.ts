import { getContestBySlug, getContestEntry, canViewContest, isContestJudge, shouldRevealScores } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';

/**
 * GET /api/contests/:slug/entries/:entryId
 * One enriched entry for the detail / judge views. Per-stage artifacts and
 * per-judge scores are privilege-gated (owner / admin / panel judge), with the
 * entrant always able to see their own artifacts. Aggregate score visibility
 * honours the contest's judgingVisibility, same as the entries listing.
 */
export default defineEventHandler(async (event): Promise<ContestEntryItem> => {
  requireFeature('contests');
  const db = useDB();
  const { slug, entryId } = parseParams(event, { slug: 'string', entryId: 'uuid' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const user = getOptionalUser(event);
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const entry = await getContestEntry(db, entryId);
  if (!entry || entry.contestId !== contest.id) {
    throw createError({ statusCode: 404, statusMessage: 'Entry not found' });
  }

  let privileged = false;
  if (user) {
    privileged =
      user.id === contest.createdById ||
      hasPermission(event, 'contest.manage') ||
      (await isContestJudge(db, contest.id, user.id));
  }
  const isEntrant = !!user && user.id === entry.userId;
  const config = useConfig();
  const artifactsOn = (config.features as unknown as Record<string, boolean>).contestStageSubmissions !== false;

  if (!shouldRevealScores(contest.judgingVisibility, contest.status, privileged)) {
    entry.score = null;
    // Per-round snapshot scores honour revealScores too (the cohort outcome
    // itself stays public, mirroring the entries listing).
    entry.stageState = entry.stageState.map((s) => ({ ...s, score: null }));
  }
  if (!privileged) {
    delete entry.judgeScores;
  }
  if (!artifactsOn || !(privileged || isEntrant)) {
    delete entry.stageSubmissions;
  }
  return entry;
});
