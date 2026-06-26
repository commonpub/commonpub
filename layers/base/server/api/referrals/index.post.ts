import { createReferralLink } from '@commonpub/server';
import { createReferralLinkSchema } from '@commonpub/schema';

/** POST /api/referrals — create a referral link (custom or auto-generated code). */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createReferralLinkSchema);

  const res = await createReferralLink(db, user.id, input, {
    defaultWindowDays: config.referral?.defaultAttributionWindowDays,
  });
  if (!res.ok) {
    throw createError({ statusCode: 400, statusMessage: res.error });
  }
  return { link: res.link };
});
