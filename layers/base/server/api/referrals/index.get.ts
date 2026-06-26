import { listMyReferralLinks } from '@commonpub/server';

/** GET /api/referrals — the logged-in user's own referral links (newest first). */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const user = requireAuth(event);
  const db = useDB();
  const links = await listMyReferralLinks(db, user.id);
  return { links };
});
