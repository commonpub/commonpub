import { createRateLimitStore } from '@commonpub/server';
import { getAuthInstance } from '../../middleware/auth';

/**
 * POST /api/user/resend-verification — re-send the signed-in user's own
 * verification email (session 253, soft verification).
 *
 * Deliberately NOT under `/api/auth/`. Two reasons:
 *  1. Better Auth owns that whole prefix, so a file there would be swallowed by
 *     its router.
 *  2. `middleware/auth.ts` dispatches Better Auth routes with `sendWebResponse`,
 *     which ends the response — so the CSRF and global rate-limit middleware
 *     that run alphabetically AFTER it never execute for anything under
 *     `/api/auth`. Better Auth's own stock send-verification-email endpoint is
 *     additionally unauthenticated and takes an arbitrary address in the body,
 *     which is why that path is now closed off in the middleware.
 *
 * The contract here is deliberately narrow: the address always comes from the
 * SESSION and is never read from the body, so this cannot be pointed at a
 * victim, and it is not an existence oracle. Every non-sendable case returns the
 * same `{ ok: true }` rather than a distinguishing error, so a caller cannot
 * probe instance configuration or another account's verification state.
 */
const store = createRateLimitStore({
  redisUrl: process.env.NUXT_REDIS_URL,
  keyPrefix: 'cpub:ratelimit:resendverify',
});

// Deliberately tighter than the global `/api/*` tier (60/min): this route causes
// an outbound email, and the honest need is "I did not get it, send it again",
// which three tries in fifteen minutes covers. The global limiter is per
// two-segment path prefix and shared with every other /api/user route, and it is
// disabled entirely in dev, so it cannot be relied on here.
const TIER = { limit: 3, windowMs: 15 * 60 * 1000 };

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = requireAuth(event);
  const config = useConfig();

  // Already confirmed: nothing to do, and say nothing about why — that IS
  // account state, so a distinguishing error would be an oracle.
  if (user.emailVerified === true) return { ok: true };

  // Feature off, or no real transport behind it: report honestly with a 503.
  // Neither fact is a secret (the flag is already public via /api/features) and
  // neither is per-account, so this leaks nothing — while silently answering
  // `{ ok: true }` made the UI announce "Verification email sent" on an instance
  // that had sent nothing and never would.
  const enabled = config.features.emailVerification === true
    || config.auth.requireEmailVerification === true;
  if (!enabled || !isEmailDeliverable()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Verification email is not available on this instance',
    });
  }

  const rl = await store.check(`user:${user.id}`, TIER);
  if (!rl.allowed) {
    // h3 types the well-known Retry-After header as a number of seconds.
    setResponseHeader(event, 'Retry-After', Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)));
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  try {
    // Through Better Auth's server API rather than a hand-rolled token: the link
    // carries an HS256 JWT of { email, updateTo } that only it can mint, and the
    // sendVerificationEmail hook wired in middleware/auth.ts points the mail at
    // our branded /auth/verify-email page.
    await getAuthInstance().api.sendVerificationEmail({
      body: { email: user.email },
      headers: new Headers(getRequestHeaders(event) as Record<string, string>),
    });
  } catch (err: unknown) {
    // Log for the operator, who has no other record — auth mail deliberately
    // bypasses email_outbox. Then tell the caller the truth: reporting success
    // for a send that failed is how a user ends up waiting for a mail that is
    // never coming. 503 carries no account information.
    console.error('[resend-verification] send failed:', err instanceof Error ? err.message : err);
    throw createError({
      statusCode: 503,
      statusMessage: 'Could not send the verification email right now',
    });
  }

  return { ok: true };
});
