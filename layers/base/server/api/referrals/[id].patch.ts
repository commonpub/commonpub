import { updateReferralLink } from '@commonpub/server';
import { updateReferralLinkSchema } from '@commonpub/schema';

/** PATCH /api/referrals/:id — update label / actions / landingPath / status. */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, updateReferralLinkSchema);

  const res = await updateReferralLink(db, user.id, id, input);
  if (!res.ok) {
    throw createError({ statusCode: res.error === 'Not found' ? 404 : 400, statusMessage: res.error });
  }
  return { link: res.link };
});
