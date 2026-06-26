import { resolveReferral } from '@commonpub/server';

/**
 * GET /api/referrals/resolve?code=... — public lookup for the signup banner
 * ("invited by X, you'll join Y"). No auth. Returns only the owner's public
 * identity + target hub names; null for an unknown/disabled/invalid code.
 */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const code = getQuery(event).code;
  if (typeof code !== 'string' || code.length === 0) {
    return { referral: null };
  }
  const db = useDB();
  const referral = await resolveReferral(db, code);
  return { referral };
});
