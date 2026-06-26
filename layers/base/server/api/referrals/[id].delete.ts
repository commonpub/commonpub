import { deleteReferralLink } from '@commonpub/server';

/** DELETE /api/referrals/:id — delete one of the user's own referral links. */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const ok = await deleteReferralLink(db, user.id, id);
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  return { ok: true };
});
