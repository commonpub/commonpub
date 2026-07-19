import { getContestBySlug, canViewContest, isContestEditor, buildRegistrantsExport } from '@commonpub/server';

/**
 * GET /api/contests/:slug/registrants-export   (CSV)
 * The organizer's registrants spreadsheet: one row per `full` participant, one
 * column per registration-form answer field (labelled by the operator). PII columns
 * are included ONLY when the requester holds `contest.pii`. Organizer-only — the
 * contest owner, a `contest.manage` holder, or a per-contest editor (NOT judges).
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
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot export this contest’s registrants' });
  }

  const includePii = hasPermission(event, 'contest.pii');
  const result = await buildRegistrantsExport(db, contest.id, includePii);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
  setHeader(event, 'Content-Disposition', `attachment; filename="${result.filename}"`);
  setHeader(event, 'Cache-Control', 'no-store');
  return `﻿${result.csv}`;
});
