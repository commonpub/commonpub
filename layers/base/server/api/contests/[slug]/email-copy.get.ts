import { getContestBySlug, getContestEmailCopy, isContestEditor } from '@commonpub/server';
import type { ContestEmailCopy } from '@commonpub/schema';

/**
 * GET /api/contests/:slug/email-copy — the stored per-contest email copy override
 * for the editor to load. Organizer-only: the public contest DTO deliberately
 * never carries this field, so the editor fetches it here behind the same gate as
 * the preview route. Returns `{}` when no override is set. Gated on `contests` +
 * `contestEmailEditor` + an authorized editor.
 */
export default defineEventHandler(async (event): Promise<ContestEmailCopy> => {
  requireFeature('contests');
  requireFeature('contestEmailEditor');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  return getContestEmailCopy(db, contest.id);
});
