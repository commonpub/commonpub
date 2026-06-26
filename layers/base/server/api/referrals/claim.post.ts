import { z } from 'zod';
import { claimReferral } from '@commonpub/server';

const claimSchema = z.object({ code: z.string().min(1).max(64).optional() }).strict();

/**
 * POST /api/referrals/claim — the primary, deterministic claim trigger. Called
 * by the register page right after signup: attributes the new user, runs the
 * link's onboarding actions (auto-join hub), and returns the destination to
 * redirect to. The code comes from the body (`?ref=` the page carries) or the
 * `cpub_ref` cookie. Idempotent server-side; the carrier is cleared after.
 */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const user = requireAuth(event);
  const db = useDB();
  const body = await parseBody(event, claimSchema);

  const decoded = decodeReferralCookie(getCookie(event, REFERRAL_COOKIE));
  // Single-shot: clear the carrier regardless of outcome.
  deleteCookie(event, REFERRAL_COOKIE, { path: '/' });
  const code = body.code ?? decoded?.code;
  if (!code) {
    return { attributed: false, destination: null };
  }

  const res = await claimReferral(db, { userId: user.id, code, clickedAt: decoded?.clickedAt });
  return { attributed: res.attributed, destination: res.destination };
});
