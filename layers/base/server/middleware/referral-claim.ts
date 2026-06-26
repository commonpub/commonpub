// Referral attribution backstop (session 229).
//
// The register page calls POST /api/referrals/claim explicitly (deterministic,
// returns the redirect destination). This middleware is the safety net for the
// paths that page never runs: OAuth/federated signup (the user returns from an
// external IdP) and the closed-tab case. It claims server-side on the first
// authenticated request that still carries the `cpub_ref` cookie.
//
// Cost: a single cookie-presence check early-returns on ~100% of requests (the
// cookie only exists between clicking a /r link and the first post-signup
// request, and is cleared on the first claim). The actual claim runs at most
// once per referred user. Runs after auth.ts (alphabetical order) so the
// session is already resolved.
//
// It SKIPS /api/referrals/* so the explicit claim endpoint owns its own request
// (no preempt). claimReferral is idempotent + race-proof and applies the
// new-user guard using the cookie's recorded click time, so an existing user who
// merely clicked a link is never attributed.
import { claimReferral } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const raw = getCookie(event, REFERRAL_COOKIE);
  if (!raw) return; // the cheap gate — almost every request exits here

  const path = event.path || '';
  if (path.startsWith('/_nuxt') || path.startsWith('/__nuxt')) return; // asset noise
  if (path.startsWith('/api/referrals/')) return; // the explicit endpoint owns these

  const user = getOptionalUser(event);
  if (!user) return; // not signed in yet — wait for the session

  // Clear the carrier no matter what happens below (single-shot).
  deleteCookie(event, REFERRAL_COOKIE, { path: '/' });

  const config = useConfig();
  if (config.features.referralLinks !== true) return; // feature off → just drop the cookie

  const decoded = decodeReferralCookie(raw);
  if (!decoded) return;

  try {
    await claimReferral(useDB(), { userId: user.id, code: decoded.code, clickedAt: decoded.clickedAt });
  } catch (err) {
    console.error('[referral] backstop claim failed:', err instanceof Error ? err.message : err);
  }
});
