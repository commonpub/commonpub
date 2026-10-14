/**
 * An absolute og:image URL, with the instance's default card as the fallback.
 *
 * Until session 262 five pages emitted `og:image=/og-default.png`: a relative
 * URL (the Open Graph spec needs an absolute one) to a file that existed on no
 * instance, so every shared hub, profile, learning path and cover-less post or
 * contest unfurled with a broken image. The layer now ships `public/og-default.png`
 * and a fork replaces it by shipping its own file at the same path.
 *
 * Resolved eagerly, in setup: the returned function only reads a captured string,
 * so it is safe inside a `useSeoMeta` getter (see plugins/seo-brand.ts).
 */
export function useOgImage(): (url?: string | null) => string {
  const siteUrl = String(useRuntimeConfig().public.siteUrl ?? '').replace(/\/+$/, '');
  return (url?: string | null): string => {
    if (!url) return `${siteUrl}/og-default.png`;
    if (/^https?:\/\//i.test(url)) return url;
    return `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };
}
