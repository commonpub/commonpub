import { getContestBySlug, canViewContest, isContestEditor, isContestJudge, buildContestExport } from '@commonpub/server';

/**
 * GET /api/contests/:slug/export   (CSV)
 * The offline-judging spreadsheet: one row per entry (all of them, not the 100
 * cap), one empty column per rubric criterion for manual tallying. PII columns
 * are included ONLY when the requester holds `contest.pii`. Gated to the contest
 * owner / a `contest.manage` holder / a per-contest editor / an accepted judge.
 */
export default defineEventHandler(async (event): Promise<string> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const canManage =
    user.id === contest.createdById ||
    hasPermission(event, 'contest.manage') ||
    (await isContestEditor(db, contest.id, user.id));
  const isJudge = await isContestJudge(db, contest.id, user.id);
  if (!canManage && !isJudge) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot export this contest' });
  }

  // PII columns only for `contest.pii` holders (admin/staff), never plain judges.
  const includePii = hasPermission(event, 'contest.pii');
  const result = await buildContestExport(db, contest.id, includePii);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
  setHeader(event, 'Content-Disposition', `attachment; filename="${result.filename}"`);
  // UTF-8 BOM so Excel detects the encoding.
  return `﻿${result.csv}`;
});
