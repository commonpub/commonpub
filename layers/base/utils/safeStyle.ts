/**
 * Build a CSS `background-image` style from a possibly-untrusted URL — e.g. a
 * federated hub's banner, which is now writable via inbound ActivityPub.
 *
 * Returns `{}` unless the URL is http(s). The URL is percent-encoded (so a `"`
 * or backslash can't terminate the quoted string) and wrapped in double quotes,
 * so a crafted value cannot break out of the `url(...)` context and inject CSS.
 */
export function bannerBgStyle(
  url: string | null | undefined,
  extra: Record<string, string> = { backgroundSize: 'cover', backgroundPosition: 'center' },
): Record<string, string> {
  if (!url || !/^https?:\/\//i.test(url)) return {};
  const safe = encodeURI(url).replace(/["\\]/g, '');
  return { backgroundImage: `url("${safe}")`, ...extra };
}
