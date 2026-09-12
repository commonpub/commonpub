import { countAnnouncementRecipients, getContestBySlug, isContestEditor } from '@commonpub/server';
import { contestAnnouncementAudienceSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/announcements/recipients — how many people an audience
 * resolves to, so the organizer sees a live count before sending.
 *
 * Returns a COUNT and nothing else. The recipients themselves (addresses, names)
 * never travel back to the client; only the server-side render sees them.
 *
 * It shares `countAnnouncementRecipients` with the send, which is the point: a
 * count produced by a second, parallel predicate would eventually disagree with
 * what actually gets mailed.
 */
export default defineEventHandler(async (event): Promise<{ count: number }> => {
  requireFeature('contests');
  requireFeature('contestBroadcast');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const audience = await parseBody(event, contestAnnouncementAudienceSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  const config = useConfig();
  const count = await countAnnouncementRecipients(db, contest.id, audience, config.features.emailUnverified);
  return { count };
});
