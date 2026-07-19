import { getContestBySlug, canViewContest, isContestEditor, listContestRegistrants } from '@commonpub/server';
import { z } from 'zod';

/**
 * GET /api/contests/:slug/registrants   (JSON)
 * The organizer's list of `full` participants (newest first) with their
 * registration answers. Organizer-only — the contest owner, a `contest.manage`
 * holder, or a per-contest editor (NOT judges). Private (PII) answers are included
 * ONLY when the requester also holds `contest.pii`. Feature-gated behind `contests`.
 */
const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const { limit, offset } = parseQueryParams(event, querySchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const canManage =
    user.id === contest.createdById ||
    hasPermission(event, 'contest.manage') ||
    (await isContestEditor(db, contest.id, user.id));
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot view this contest’s registrants' });
  }

  const includePii = hasPermission(event, 'contest.pii');
  const { items, total } = await listContestRegistrants(db, contest.id, { limit, offset, includePii });

  // Registrant answers can carry PII — never cache anywhere.
  setHeader(event, 'Cache-Control', 'no-store');
  // Echo the EFFECTIVE template (the default 3 fields for legacy contests) so the
  // client can label-map even legacy {building,experience,team} answers.
  return { items, total, template: effectiveRegistrationTemplate(contest.registrationTemplate), includePii };
});
