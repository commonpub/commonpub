import { getContestBySlug, deleteContest } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ deleted: boolean }> => {
  requireFeature('contests');
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });


  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  // Owner OR a contest.manage holder (RBAC Phase 1) may delete. Flag-off this is
  // owner-or-admin, byte-identical to before; flag-on a custom managing role works.
  const canManage = ownerOrPermission(event, contest.createdById, 'contest.manage');
  const deleted = await deleteContest(db, contest.id, user.id, canManage);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to delete this contest' });
  }

  return { deleted: true };
});
