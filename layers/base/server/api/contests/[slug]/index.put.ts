import { updateContest, getContestBySlug, isContestEditor } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';
import { updateContestSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, updateContestSchema);

  // Owner, a per-contest `editor` stakeholder, or a `contest.manage` holder may
  // edit. The owner check inside updateContest covers the owner; pass canManage
  // for the permission/editor paths (editor is also re-checked server-side).
  const contest = await getContestBySlug(db, slug);
  const canManage = contest
    ? ownerOrPermission(event, contest.createdById, 'contest.manage') ||
      (await isContestEditor(db, contest.id, user.id))
    : false;

  let result;
  try {
    result = await updateContest(db, slug, user.id, input, canManage);
  } catch (err) {
    if (err instanceof Error && err.message === 'SLUG_TAKEN') {
      throw createError({ statusCode: 409, statusMessage: 'That URL slug is already in use by another contest.' });
    }
    throw err;
  }
  if (!result) throw createError({ statusCode: 403, statusMessage: 'Not authorized or contest not found' });
  return result;
});
