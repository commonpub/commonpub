import { submitContestProposal, getContestBySlug, canViewContest } from '@commonpub/server';
import { stageSubmissionSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/proposal
 * Form-first proposal entry (Phase 4). Validates the stage form, creates a DRAFT
 * placeholder project, links a contest entry to it, and records agreement
 * acceptances + PII separately. Gated by features.contestProposals; the server
 * enforces that the target stage is the current, proposal-mode submission stage.
 */
export default defineEventHandler(async (event): Promise<{ entryId: string; projectSlug: string }> => {
  requireFeature('contests');
  requireFeature('contestProposals');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const input = await parseBody(event, stageSubmissionSchema);
  const result = await submitContestProposal(db, {
    contestId: contest.id,
    stageId: input.stageId,
    fields: input.fields,
    userId: user.id,
    ip: getRequestIP(event) ?? null,
  });
  if (!result.ok) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }
  return { entryId: result.entryId, projectSlug: result.projectSlug };
});
