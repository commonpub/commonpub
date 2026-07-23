/**
 * Build a cover-image `src`, routing only ABSOLUTE remote HTTPS images through
 * `/api/image-proxy` (which caches slow cross-origin/federated images). The proxy
 * requires an absolute HTTPS URL and 400s ("Invalid URL") on anything else, so
 * relative/same-origin URLs (uploads, `/favicon.svg`, `data:` URIs) MUST be served
 * directly — never proxied.
 *
 * Single source of truth: card components had drifted copies of this guard, one of
 * which lacked the `new URL()` parse and proxied relative covers → a live 400 on
 * every contest card whose cover is a relative path.
 *
 * @param siteDomain `config.public.domain` (may include a port); same-origin
 *   images are served directly. When empty (unset) a remote HTTPS URL is proxied,
 *   since same-origin can't be detected.
 */
export function proxiedImageUrl(
  url: string | null | undefined,
  siteDomain: string,
  w = 600,
): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // relative or malformed → serve directly, never proxy
  }
  // The proxy is HTTPS-only; http/data/blob are served as-is.
  if (parsed.protocol !== 'https:') return url;
  // Same-origin images are served directly (nothing to cache cross-origin).
  if (siteDomain && url.includes(siteDomain)) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}&w=${w}`;
}
