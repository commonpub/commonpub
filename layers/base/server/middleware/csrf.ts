// CSRF defense for cookie-authenticated custom `/api/*` routes (audit session 204).
//
// The custom Nitro `/api/*` routes authenticate the browser via the Better Auth
// SESSION COOKIE (resolved in middleware/auth.ts). Cookies are sent automatically
// on cross-site requests, so without an Origin check a malicious page could drive
// a logged-in user's browser to issue state-changing POST/PUT/PATCH/DELETE calls
// (classic CSRF).
//
// This middleware runs ahead of the route handler (Nitro runs middleware
// alphabetically — `csrf.ts` sorts before `features.ts`, `public-api-auth.ts`,
// `security.ts`, `theme.ts`; after `auth.ts`, `content-*`. It does NOT depend on
// auth's resolved session — it makes its own decision purely from the presence of
// the session cookie + the Origin/Referer header, so ordering relative to auth.ts
// is irrelevant) and rejects any unsafe-method `/api/*` request that:
//   1. carries a Better Auth session cookie (i.e. is cookie-authenticated), AND
//   2. whose Origin (or, lacking that, Referer) host does NOT match the request host.
//
// Requests with NO session cookie pass through untouched: bearer-token public-API
// callers (`/api/public/*`), AP inbox (`/`-level, HTTP-signature auth), and plain
// unauthenticated requests are not cookie-CSRF-able.
//
// Exemptions:
//   - `/api/auth/*`  — Better Auth enforces its own CSRF via trustedOrigins.
//   - `/api/public/*` — bearer-token auth, no cookie reliance.
//
// Why legit usage is unaffected: a same-origin browser fetch/XHR always sends an
// `Origin` header whose host equals the page host (and the API host, same origin),
// so the host comparison passes. Cross-site attacker requests send the attacker's
// Origin (or, for top-level form posts, a Referer from the attacker's page), which
// won't match — and even Origin-less navigations carrying the cookie are blocked.
import { getBetterAuthSessionCookieName } from '../utils/betterAuthCookie';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Extract the host (host:port) from an absolute URL string; null if unparseable. */
function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export default defineEventHandler((event) => {
  const method = event.method.toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return;

  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Only guard custom cookie-auth API routes.
  if (!pathname.startsWith('/api/')) return;
  // Better Auth owns its own CSRF; bearer-token public API doesn't use the cookie.
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/public/')) return;

  // Is this request cookie-authenticated? Check both possible cookie names
  // (`__Secure-`-prefixed in prod / HTTPS, bare otherwise) so we don't depend on
  // env detection being perfectly in sync — if EITHER is present, treat it as a
  // cookie-auth attempt and enforce the origin check.
  const hasSessionCookie =
    getCookie(event, getBetterAuthSessionCookieName(true)) !== undefined ||
    getCookie(event, getBetterAuthSessionCookieName(false)) !== undefined;

  // No session cookie => not cookie-CSRF-able (bearer / public / anonymous). Pass.
  if (!hasSessionCookie) return;

  const requestHost = url.host;

  // Prefer Origin (sent on all CORS-relevant requests incl. same-origin fetch);
  // fall back to Referer for environments/requests that omit Origin.
  const originHeader = getRequestHeader(event, 'origin');
  const originHost = hostOf(originHeader);

  if (originHost !== null) {
    if (originHost !== requestHost) {
      throw createError({ statusCode: 403, statusMessage: 'CSRF origin check failed' });
    }
    return;
  }

  const refererHost = hostOf(getRequestHeader(event, 'referer'));
  if (refererHost !== null) {
    if (refererHost !== requestHost) {
      throw createError({ statusCode: 403, statusMessage: 'CSRF origin check failed' });
    }
    return;
  }

  // Cookie-authenticated unsafe request with NO Origin AND NO Referer: cannot be
  // proven same-origin, so reject. Legitimate browser XHR/fetch always sends one.
  throw createError({ statusCode: 403, statusMessage: 'CSRF origin check failed' });
});
