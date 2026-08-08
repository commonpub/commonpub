import { URL_LINK_STRICT } from '@commonpub/schema';

/**
 * Registration-link block — the shared, pure href/label logic.
 *
 * This block renders a call-to-action button pointing at a sign-up URL and is
 * droppable into any BlockTuple[] content (articles, projects, explainers,
 * contests, and the contest email body). No server route validates block
 * content against a schema, so URL safety MUST live in one place and be applied
 * by every renderer — this module is that single source, imported by the Vue
 * view (`BlockRegistrationLinkView`) AND the email HTML renderer
 * (`renderEmailBlocks`).
 */

/** Default sign-up destination when the block leaves its URL blank. Root-relative
 *  so it resolves against whatever host the instance serves. */
export const REGISTRATION_DEFAULT_URL = '/auth/register';

export interface RegistrationLinkContent {
  /** CTA button label. Blank ⇒ "Register". */
  label?: string;
  /** Destination. Blank or not an allowed anchor target ⇒ REGISTRATION_DEFAULT_URL. */
  url?: string;
  /** Optional referral code (session 229 referralLinks) appended as `?ref=<code>`
   *  for signup attribution. Harmless when referralLinks is off — the register
   *  page simply ignores an unrecognized ref. */
  ref?: string;
  /** Visual style hint. */
  variant?: 'primary' | 'secondary';
}

type MaybeContent = RegistrationLinkContent | Record<string, unknown>;

/**
 * Resolve the SAFE href for a registration-link block. Falls back to
 * `opts.fallbackUrl` (default: the instance register page) when the URL is blank
 * or not an allowed anchor target (http(s), root path, fragment, mailto, tel —
 * `URL_LINK_STRICT`; blocks `javascript:` and other smuggles). A referral code is
 * appended as a query param, but only to http(s)/root targets (never a
 * fragment/mailto/tel).
 *
 * `opts.fallbackUrl` exists because the account-signup page is the right default
 * only in PUBLIC content. In a contest participation email the recipient already
 * has an account and is already registered, so "create an account" is a dead end —
 * those send paths pass the contest's own registration page instead. The injected
 * fallback goes through the same safety guard, so an unusable value degrades to
 * the register page rather than emitting an unsafe href.
 */
export function buildRegistrationHref(content: MaybeContent, opts?: { fallbackUrl?: string }): string {
  const rawUrl = typeof content.url === 'string' ? content.url.trim() : '';
  // URL_LINK_STRICT permits any `/`-prefixed value, which includes off-site
  // targets a browser resolves against the current origin: protocol-relative
  // `//evil.com` AND backslash variants `/\evil.com` / `/\/evil.com` (the URL
  // parser normalizes `\` → `/`, so `/\evil.com` becomes `//evil.com`). A
  // registration CTA must not become an open redirect, so reject any leading
  // `/` immediately followed by another `/` or `\`.
  const isSafeTarget = (u: string): boolean => !!u && URL_LINK_STRICT.test(u) && !/^\/[/\\]/.test(u);
  const rawFallback = typeof opts?.fallbackUrl === 'string' ? opts.fallbackUrl.trim() : '';
  const fallback = isSafeTarget(rawFallback) ? rawFallback : REGISTRATION_DEFAULT_URL;
  const base = isSafeTarget(rawUrl) ? rawUrl : fallback;
  const ref = typeof content.ref === 'string' ? content.ref.trim() : '';
  if (!ref) return base;
  if (base.startsWith('#') || base.startsWith('mailto:') || base.startsWith('tel:')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ref=${encodeURIComponent(ref)}`;
}

/**
 * Absolutize a site-relative href against the instance origin, for renderers that
 * have NO base URL to resolve against — email above all.
 *
 * A root-relative `/auth/register` is correct in the app (it resolves against
 * whatever host serves the page) but is BROKEN in an email: there is no document
 * base, so a mail client that prepends the scheme produces `https:///auth/register`,
 * which the URL parser normalizes by promoting the first path segment to the host —
 * the user lands on `https://auth/register`. Every non-browser renderer of a block
 * href MUST run it through here with the instance's site URL.
 *
 * Already-absolute (`http(s)://`) and non-navigational (`mailto:`/`tel:`) targets are
 * returned untouched, as is any href when no origin is supplied (nothing better to do
 * than leave it as authored).
 */
export function absolutizeHref(href: string, origin?: string | null): string {
  const trimmed = typeof origin === 'string' ? origin.trim().replace(/\/+$/, '') : '';
  // Require a real scheme+host. A misconfigured instance can hand us `https://`
  // (siteUrl unset AND instance.domain blank); prefixing with that would emit
  // `https:/auth/register` — leave the href as authored instead of corrupting it.
  const base = /^https?:\/\/[^/\s]+(\/\S*)?$/i.test(trimmed) ? trimmed : '';
  if (!base) return href;
  if (href.startsWith('/')) return `${base}${href}`;
  // A bare fragment has no page to anchor to in an email; point it at the site root.
  if (href.startsWith('#')) return `${base}/${href}`;
  return href;
}

/** Resolve the button label, defaulting to "Register" when blank. */
export function registrationLabel(content: MaybeContent): string {
  const label = typeof content.label === 'string' ? content.label.trim() : '';
  return label || 'Register';
}

/** The button style hint, defaulting to primary. */
export function registrationVariant(content: MaybeContent): 'primary' | 'secondary' {
  return content.variant === 'secondary' ? 'secondary' : 'primary';
}
