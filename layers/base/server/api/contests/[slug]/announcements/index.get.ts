import { getContestBySlug, isContestEditor, listContestAnnouncements } from '@commonpub/server';
import type { ContestAnnouncementSummary } from '@commonpub/server';

/**
 * GET /api/contests/:slug/announcements — this contest's announcement history for
 * the organizer's Announcements tab. Organizer-only, behind the same gate as the
 * other contest email routes.
 *
 * Deliberately returns no recipient identities: an organizer sees WHAT they sent
 * and HOW MANY it reached, never who. Addresses stay server-side, matching the
 * `contest.pii` boundary the registrants panel already enforces.
 */
export default defineEventHandler(async (event): Promise<ContestAnnouncementSummary[]> => {
  requireFeature('contests');
  requireFeature('contestBroadcast');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  return listContestAnnouncements(db, contest.id);
});
