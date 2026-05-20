/**
 * Helpers for setting/clearing Better Auth (1.6.4 / better-call 1.3.5)
 * session cookies from custom Nitro routes that mint a session WITHOUT
 * going through the auth router (federated SSO callbacks).
 *
 * Federation-hardening Item 8. Before this helper, the callbacks at
 * `auth/federated/callback.get.ts`, `auth/mastodon/callback.get.ts`,
 * and `auth/federated/link.post.ts` set the cookie themselves with a
 * BARE token and the BARE `better-auth.session_token` name. Better
 * Auth (1.6.4) `getSignedCookie` requires `${token}.${HMAC}` format
 * and the `__Secure-` prefix in production — so the bare-token cookie
 * silently authenticated as anonymous on the next request (redirect to
 * /dashboard but no session). Fail-closed (no bypass) but a complete
 * functional break of the flagged auth flows. Identity flags
 * `linkRemoteAccounts`/`signInWithRemote` are OFF in prod, so dormant.
 *
 * Cookie shape pinned against the vendored `better-auth@1.6.4` +
 * `better-call@1.3.5`:
 *   - Name: `${prefix}better-auth.session_token` where
 *     `prefix === '__Secure-'` when NODE_ENV=production (matches
 *     better-auth's `isProduction` check in `cookies/index.mjs:20`).
 *   - Value: `encodeURIComponent(`${token}.${base64(HMAC-SHA256(secret, token))}`)`
 *     (matches `better-call/dist/crypto.mjs:22-32` `makeSignature`
 *     + `signCookieValue`).
 *   - Attributes: `httpOnly: true, secure: isProd, sameSite: 'lax', path: '/'`.
 *     Default attributes match `cookies/index.mjs:30-39` exactly.
 *
 * Node `createHmac('sha256', secret).update(token).digest('base64')` is
 * byte-identical to better-auth's `btoa(String.fromCharCode(...uint8Array))`:
 * both are RFC 4648 standard base64 with `=` padding (the signature is
 * verified by `getSignedCookie` requiring `length === 44 && endsWith('=')`).
 */
import { createHmac } from 'node:crypto';
import type { H3Event } from 'h3';

/** Better Auth session-token cookie name; `__Secure-` prefix when secure. */
export function getBetterAuthSessionCookieName(useSecurePrefix: boolean): string {
  return useSecurePrefix ? '__Secure-better-auth.session_token' : 'better-auth.session_token';
}

/** Better Auth session_data cookie name (SSR cookie cache); `__Secure-` prefix when secure. */
export function getBetterAuthSessionDataCookieName(useSecurePrefix: boolean): string {
  return useSecurePrefix ? '__Secure-better-auth.session_data' : 'better-auth.session_data';
}

/**
 * Decide whether to apply the `__Secure-` cookie name prefix. Matches Better
 * Auth's logic from `cookies/index.mjs:20` exactly:
 *   useSecure = options.useSecureCookies ?? baseURL.startsWith('https://') ?? isProduction
 *
 * Production always uses secure (we never want bare cookies in prod). In dev,
 * checking `siteUrl.startsWith('https://')` covers the local-HTTPS case so
 * `getSession` still finds our cookie (Better Auth applies the prefix when
 * its baseURL is HTTPS, even outside production).
 */
export function shouldUseSecurePrefix(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  try {
    const cfg = useRuntimeConfig();
    const pub = cfg.public as Record<string, unknown> | undefined;
    const siteUrl = pub?.siteUrl;
    if (typeof siteUrl === 'string' && siteUrl.startsWith('https://')) return true;
  } catch {
    // useRuntimeConfig unavailable outside a Nitro request context (e.g.
    // tests that import this module without setting up Nuxt). Fall through.
  }
  return false;
}

/**
 * Build the signed cookie value `${token}.${base64(HMAC-SHA256(secret, token))}`.
 * Returns the RAW string — NOT URL-encoded. h3's `setCookie` calls
 * `cookie-es.serialize` which `encodeURIComponent`s the value exactly
 * once on the way out (see `cookie-es@3.x/dist/index.mjs` —
 * `const enc = options?.encode || encodeURIComponent`). Pre-encoding
 * here would double-encode (`+` → `%2B` → `%252B` on the wire), and
 * Better Auth's `getSignedCookie` only decodes ONCE before checking
 * `signature.length === 44 && endsWith('=')` — so the signature
 * fails to parse and every federated session lands as anonymous.
 * Same class of bug as session 149's safeFetch P0 (algorithm correct
 * in isolation, broken once the surrounding layer runs).
 */
export function signBetterAuthCookieValue(token: string, secret: string): string {
  if (!secret) {
    throw new Error('signBetterAuthCookieValue: secret is required');
  }
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return `${token}.${signature}`;
}

/**
 * Resolve the auth-signing secret. MUST match `middleware/auth.ts`'s
 * secret-resolution logic exactly (lines 27-33) — if the two diverge,
 * our cookies are signed with a different key than Better Auth's
 * `getSession` verifies against, and every federated session lands as
 * anonymous. KEEP IN SYNC WITH `middleware/auth.ts`.
 *
 * Prod-without-AUTH_SECRET throws (matches middleware's startup throw).
 * Dev-without-AUTH_SECRET falls back to the shared `dev-secret-change-me`
 * sentinel so federated callbacks work in `pnpm dev` without env config.
 */
function getAuthSecret(): string {
  const cfg = useRuntimeConfig();
  const s = cfg.authSecret as string | undefined;
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production');
  }
  return s || 'dev-secret-change-me';
}

/**
 * Set a Better Auth session-token cookie on the H3 event. Produces a cookie
 * indistinguishable from one Better Auth itself would have set during the
 * sign-in/email flow — same name, same signed value, same attributes — so
 * `getSession` (which reads via `getSignedCookie`) authenticates the
 * subsequent request.
 */
export function setBetterAuthSessionCookie(event: H3Event, token: string, expiresAt: Date): void {
  const useSecure = shouldUseSecurePrefix();
  const secret = getAuthSecret();
  const value = signBetterAuthCookieValue(token, secret);
  setCookie(event, getBetterAuthSessionCookieName(useSecure), value, {
    httpOnly: true,
    secure: useSecure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Clear both Better Auth cookies (session token + SSR session_data cache).
 * Use from delete-user / explicit sign-out flows that need to wipe the
 * Better Auth cookie state without invoking the auth router.
 */
export function clearBetterAuthSessionCookies(event: H3Event): void {
  const useSecure = shouldUseSecurePrefix();
  const opts = { path: '/', secure: useSecure, sameSite: 'lax' as const };
  deleteCookie(event, getBetterAuthSessionCookieName(useSecure), opts);
  deleteCookie(event, getBetterAuthSessionDataCookieName(useSecure), opts);
}
