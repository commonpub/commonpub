/**
 * CORS origin-pattern matching for the public API.
 *
 * The public API authenticates with `Authorization: Bearer <token>`, NOT
 * cookies. There are no ambient credentials, and we never send
 * `Access-Control-Allow-Credentials: true`. That makes
 * `Access-Control-Allow-Origin: *` SAFE here: a cross-origin page still
 * cannot obtain a key it does not already possess, so reflecting (or
 * wildcarding) the origin only ENABLES legitimate browser clients. The
 * Bearer token is what protects the data.
 *
 * Pattern grammar (the only metacharacter is `*`):
 *   *                        any origin (wildcard-all)
 *   localhost                shorthand, expands to http(s)://localhost on any port
 *   https://app.example.com  exact origin
 *   http://localhost:*       any port on a host
 *   https://*.example.com    any subdomain
 *   *://localhost:*          any scheme + any port
 */

export interface CorsDecision {
  /** Whether the request's origin is permitted. */
  allowed: boolean;
  /** Value for `Access-Control-Allow-Origin`, or null when not allowed. */
  headerValue: string | null;
  /** True when `headerValue` is the literal `*` (cacheable, no `Vary` needed). */
  wildcard: boolean;
}

const DENY: CorsDecision = { allowed: false, headerValue: null, wildcard: false };

// A syntactically valid web origin: scheme://host[:port], with no path, query,
// fragment, credentials, whitespace, or control characters. The INCOMING
// Origin header is validated against this before it is ever reflected into an
// `Access-Control-Allow-Origin` response header — reflecting an unvalidated
// header value is a CRLF / response-splitting sink. We validate the value's
// domain (is this actually an origin?), not just its shape. IPv6-literal and
// `null` origins are intentionally unsupported: they can't match a pattern
// anyway, and bracketed/`null` hosts are not worth the reflection risk.
const WELL_FORMED_ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;
// Control characters (C0 range + DEL), including CR, LF, and TAB. The control
// characters in this class are the whole point of the check (reject them).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/**
 * True when `origin` is a syntactically valid, reflectable web origin. Used as
 * a gate before reflecting an Origin header — both here (the actual request)
 * and in the preflight echo, which is unauthenticated.
 */
export function isWellFormedOrigin(origin: string): boolean {
  if (origin.length > 2000) return false;
  // Reject every control character explicitly: a bare `$` (no `m` flag) matches
  // just before a trailing newline, so an anchored test alone would let
  // `https://app.example.com\n` slip through and be reflected into a header.
  if (CONTROL_CHARS.test(origin)) return false;
  return WELL_FORMED_ORIGIN.test(origin);
}

/**
 * Expand shorthand patterns. `localhost` (case-insensitive) becomes both http
 * and https on any port; everything else passes through unchanged (including
 * the bare `*`). Trims each entry and drops empties so a stray comma can't
 * widen the policy.
 */
export function expandOriginPatterns(patterns: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of patterns) {
    const p = raw.trim();
    if (p === '') continue;
    if (p.toLowerCase() === 'localhost') {
      // Cover both the default-port origin (`http://localhost`, no colon) and
      // any explicit port (`http://localhost:5173`), over http and https. The
      // validator accepts `localhost` case-insensitively, so normalize here
      // too — otherwise `LOCALHOST` would compile to a dead literal pattern.
      out.push(
        'http://localhost',
        'http://localhost:*',
        'https://localhost',
        'https://localhost:*',
      );
    } else {
      out.push(p);
    }
  }
  return out;
}

// Compiled-pattern cache. Pattern sets are tiny (<=50 per key) and the
// compiled regex uses only `[^/\s]*` (no nested quantifiers), so there is no
// ReDoS surface — the cache just avoids recompiling on every request.
const compiledCache = new Map<string, RegExp>();

function compilePattern(pattern: string): RegExp {
  const cached = compiledCache.get(pattern);
  if (cached) return cached;
  // Escape every regex metacharacter, THEN turn the escaped `*` back into
  // `[^/\s]*`. Excluding `/` keeps a subdomain wildcard from crossing into a
  // path, and excluding `\s` keeps it from matching newlines/tabs (defense in
  // depth behind `isWellFormedOrigin`). Every `.` stays literal.
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withWildcard = escaped.replace(/\\\*/g, '[^/\\s]*');
  const re = new RegExp(`^${withWildcard}$`, 'i');
  compiledCache.set(pattern, re);
  return re;
}

/**
 * Decide CORS for an incoming `Origin` against a key's allow-list. Returns a
 * literal `*` when the list permits all origins; otherwise reflects the exact
 * origin (the caller then adds `Vary: Origin`). Returns a deny decision when
 * the list is empty, the origin is missing or malformed, or no pattern matches.
 *
 * The returned shape intentionally has no "credentials" concept — the public
 * API must never pair these headers with `Access-Control-Allow-Credentials`.
 */
export function matchOrigin(
  patterns: readonly string[] | null | undefined,
  origin: string | null | undefined,
): CorsDecision {
  if (!patterns || patterns.length === 0) return DENY;
  const expanded = expandOriginPatterns(patterns);
  if (expanded.includes('*')) {
    // Wildcard-all responds with the literal `*` and never reflects the raw
    // header, so a malformed origin here is harmless.
    return { allowed: true, headerValue: '*', wildcard: true };
  }
  // Reflecting path: the origin will be echoed verbatim into a response header,
  // so it MUST be a well-formed origin first (no CRLF / header injection).
  if (!origin || !isWellFormedOrigin(origin)) return DENY;
  for (const p of expanded) {
    if (compilePattern(p).test(origin)) {
      return { allowed: true, headerValue: origin, wildcard: false };
    }
  }
  return DENY;
}
