import {
  getContestBySlug,
  canViewContest,
  registerForContest,
  getRegistrantCount,
} from '@commonpub/server';

/**
 * POST /api/contests/:slug/register
 * Register the current user as a participant in a contest. Idempotent: a second
 * call is a no-op that still reports `registered: true`. On a genuinely new
 * registration a confirmation email is enqueued (best-effort, only when
 * `emailNotifications` is on and the address is verified). Returns the viewer's
 * registration state and the up-to-date registrant count. 404s an unknown slug
 * or an unviewable contest; 400s when the contest is not open for registration.
 * Requires auth; feature-gated behind `contests`.
 */
export default defineEventHandler(async (event): Promise<{ registered: boolean; count: number }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  // Per-instance context for the (best-effort) confirmation email: public origin,
  // instance name, and the AUTH_SECRET that signs the one-click unsubscribe token.
  const rc = useRuntimeConfig();
  const siteUrl = (rc.public?.siteUrl as string) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || 'CommonPub';
  const secret = (rc.authSecret as string) || '';

  const result = await registerForContest(
    db,
    config,
    { contestId: contest.id, userId: user.id },
    { siteUrl, siteName, secret },
  );

  if (!result.registered && !result.alreadyRegistered) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Could not register for this contest' });
  }

  const count = await getRegistrantCount(db, contest.id);
  return { registered: true, count };
});
