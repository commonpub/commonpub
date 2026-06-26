import { recordReferralClick } from '@commonpub/server';

/**
 * GET /r/:code — the public short link (session 229). Atomically records a click
 * and (unless cookieless mode) drops the `cpub_ref` carrier cookie, then
 * redirects to the link's destination — its `landingPath`, or the register page
 * pre-filled with `?ref=` for the "invited by X" banner. An unknown/disabled
 * code just sends the visitor to register with no attribution. 404s when the
 * feature is off.
 */
export default defineEventHandler(async (event) => {
  requireFeature('referralLinks');
  const code = getRouterParam(event, 'code') ?? '';
  const db = useDB();
  const config = useConfig();

  const link = await recordReferralClick(db, code);
  if (!link) {
    return sendRedirect(event, '/auth/register', 302);
  }

  if (!config.referral?.cookieless) {
    // Carry the code + click time so the claim can verify the account was created
    // at/after the click (the new-user guard).
    setCookie(event, REFERRAL_COOKIE, encodeReferralCookie(link.code, Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: link.attributionWindowDays * 24 * 60 * 60,
    });
  }

  const destination = link.landingPath ?? `/auth/register?ref=${encodeURIComponent(link.code)}`;
  return sendRedirect(event, destination, 302);
});
