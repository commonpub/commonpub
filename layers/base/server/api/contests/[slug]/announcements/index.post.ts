import { AnnouncementRateLimitError, getContestBySlug, isContestEditor, sendContestAnnouncement } from '@commonpub/server';
import type { SendContestAnnouncementResult } from '@commonpub/server';
import { contestAnnouncementInputSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/announcements — send an organizer-composed email to
 * this contest's participants.
 *
 * Three gates, each for a different reason:
 *  - `contests` + `contestBroadcast`: the feature is off by default.
 *  - the organizer check: owner, a `contest.manage` holder, or a per-contest editor.
 *  - `emailNotifications`: WITHOUT it the outbox drain worker returns immediately
 *    (`server/plugins/email-outbox.ts`), so every message this route enqueued
 *    would sit in the queue forever while the UI said "sent". Refusing with a
 *    clear message beats a silent success.
 *
 * The send itself is idempotent on the client's `idempotencyKey`, so a
 * double-clicked button cannot mail the audience twice.
 */

/** Sends allowed per contest per rolling window. A blast reaches every
 *  registrant's inbox; a runaway organizer is a deliverability incident for the
 *  whole instance, not just an annoyance for one contest. */
const MAX_SENDS_PER_WINDOW = 5;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default defineEventHandler(async (event): Promise<SendContestAnnouncementResult> => {
  requireFeature('contests');
  requireFeature('contestBroadcast');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, contestAnnouncementInputSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  const config = useConfig();
  if (!config.features.emailNotifications) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email delivery is turned off on this instance, so an announcement would never be sent. Ask an operator to enable Email Notifications.',
    });
  }

  const rc = useRuntimeConfig();
  const siteUrl = (rc.public?.siteUrl as string) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || 'CommonPub';
  const secret = (rc.authSecret as string) || '';

  // The bound is enforced inside the send, after its idempotency short-circuit,
  // so a retry of an announcement that already went out returns its result
  // instead of a 429 for work it is not repeating.
  try {
    return await sendContestAnnouncement(
      db,
      {
        contestId: contest.id,
        contest,
        subject: input.subject,
        bodyBlocks: input.bodyBlocks,
        audience: input.audience,
        sentBy: user.id,
        idempotencyKey: input.idempotencyKey,
        maxPerWindow: MAX_SENDS_PER_WINDOW,
        windowMs: RATE_WINDOW_MS,
      },
      { siteUrl, siteName, secret },
      undefined,
      config.features.emailUnverified,
    );
  } catch (err) {
    if (err instanceof AnnouncementRateLimitError) {
      throw createError({ statusCode: 429, statusMessage: `${err.message} Try again later.` });
    }
    throw err;
  }
});
