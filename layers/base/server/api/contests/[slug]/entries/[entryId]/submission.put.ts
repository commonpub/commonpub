import { submitStageArtifact, getContestBySlug, getContestEntry, canViewContest } from '@commonpub/server';
import type { ContestStageSubmission } from '@commonpub/schema';
import { stageSubmissionSchema } from '@commonpub/schema';

/**
 * PUT /api/contests/:slug/entries/:entryId/submission
 * Submit (or update) the entrant's per-stage artifact for the contest's
 * current submission stage. Owner-only; the server re-validates ownership,
 * stage state, the cohort gate, and the fields against the stage template.
 */
export default defineEventHandler(async (event): Promise<{ submitted: boolean; stageSubmissions: ContestStageSubmission[] }> => {
  requireFeature('contests');
  requireFeature('contestStageSubmissions');
  const user = requireAuth(event);
  const db = useDB();
  const { slug, entryId } = parseParams(event, { slug: 'string', entryId: 'uuid' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }
  // The entry must belong to THIS contest — gates were checked against this slug.
  const entry = await getContestEntry(db, entryId);
  if (!entry || entry.contestId !== contest.id) {
    throw createError({ statusCode: 404, statusMessage: 'Entry not found' });
  }

  const input = await parseBody(event, stageSubmissionSchema);
  const result = await submitStageArtifact(db, entryId, input.stageId, input.fields, user.id, getRequestIP(event) ?? null);
  if (!result.submitted) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Could not submit' });
  }
  return { submitted: true, stageSubmissions: result.stageSubmissions ?? [] };
});
