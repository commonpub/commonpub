/**
 * Path normalisation for custom-page layouts.
 *
 * Spec: docs/plans/layout-and-pages.md §6.3.
 *
 * Normalises an input path to its canonical form, OR rejects with a
 * specific reason if it violates structural rules.
 *
 * Why centralised: the rules apply at three call sites (admin save
 * handler, Nuxt catch-all page, the `useLayout` lookup), and divergence
 * between them would let admins save a `/About` layout that never gets
 * served because the catch-all looked up `/about`. Single source of
 * truth here, used everywhere.
 *
 * Examples (also pinned in tests):
 *   /about        → ok '/about'
 *   /about/       → ok '/about'           (trailing slash stripped)
 *   about         → ok '/about'           (leading slash added)
 *   /About        → ok '/about'           (lowercased)
 *   //a//b//      → ok '/a/b'             (collapsed double slashes)
 *   ' /about '    → ok '/about'           (trimmed)
 *   /about?x=1    → reject 'has-query'
 *   /about#anchor → reject 'has-fragment'
 *   /api/foo      → reject 'reserved-prefix'
 *   /             → reject 'reserved-prefix' (root is route-scope, not custom-page)
 *   ''            → reject 'empty'
 *   /a/../b       → reject 'has-dot-segment'
 *   /a//b         → ok '/a/b'             (after collapse)
 */

/**
 * Path prefixes that custom pages CANNOT claim. These either map to
 * framework internals or to built-in route-scope layouts.
 */
export const RESERVED_PREFIXES: ReadonlyArray<string> = [
  '/api',
  '/_nuxt',
  '/__nuxt',
  '/.well-known',
];

/**
 * Single-segment paths that are RESERVED (route-scope, not custom-page).
 * The homepage `/` lives in the route-scope layout, not custom-page.
 */
export const RESERVED_EXACT: ReadonlyArray<string> = ['/'];

export type NormalisePathRejection =
  | 'empty'
  | 'has-query'
  | 'has-fragment'
  | 'has-dot-segment'
  | 'reserved-prefix'
  | 'invalid-char';

export type NormalisePathResult =
  | { ok: true; path: string }
  | { ok: false; reason: NormalisePathRejection };

/**
 * Allowed character set for a single path segment. Conservative — letters,
 * digits, hyphen, underscore. No dots (would conflict with .well-known
 * convention + complicates filename-based routing) — file extensions
 * have no place in custom-page paths.
 */
const SEGMENT_RE = /^[a-z0-9_-]+$/;

export function pathNormalize(input: unknown): NormalisePathResult {
  if (typeof input !== 'string') return { ok: false, reason: 'empty' };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };

  // Reject any URL-special chars early — these shouldn't reach a custom-page path
  if (trimmed.includes('?')) return { ok: false, reason: 'has-query' };
  if (trimmed.includes('#')) return { ok: false, reason: 'has-fragment' };

  // Lowercase + ensure leading slash + collapse runs of slashes + strip trailing
  let p = '/' + trimmed.toLowerCase().replace(/^\/+/, '').replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  // After normalisation, '/' is the only single-slash result
  if (p === '/') return { ok: false, reason: 'reserved-prefix' };

  // Reserved-prefix check FIRST — some reserved paths contain characters
  // (dots in `.well-known`) that segment validation would reject with the
  // wrong reason. Operator gets the more specific 'reserved-prefix' error.
  for (const prefix of RESERVED_PREFIXES) {
    if (p === prefix || p.startsWith(prefix + '/')) {
      return { ok: false, reason: 'reserved-prefix' };
    }
  }
  if (RESERVED_EXACT.includes(p)) {
    return { ok: false, reason: 'reserved-prefix' };
  }

  // Now validate each segment is well-formed
  const segments = p.slice(1).split('/');
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return { ok: false, reason: 'has-dot-segment' };
    if (!SEGMENT_RE.test(seg)) return { ok: false, reason: 'invalid-char' };
  }

  return { ok: true, path: p };
}
