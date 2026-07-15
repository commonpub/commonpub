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
 * Resolve the SAFE href for a registration-link block. Falls back to the
 * register page when the URL is blank or not an allowed anchor target
 * (http(s), root path, fragment, mailto, tel — `URL_LINK_STRICT`; blocks
 * `javascript:` and other smuggles). A referral code is appended as a query
 * param, but only to http(s)/root targets (never a fragment/mailto/tel).
 */
export function buildRegistrationHref(content: MaybeContent): string {
  const rawUrl = typeof content.url === 'string' ? content.url.trim() : '';
  // URL_LINK_STRICT permits any `/`-prefixed value, which includes
  // protocol-relative `//evil.com` (navigates off-site). A registration CTA
  // must not become an open redirect, so reject `//` explicitly.
  const safe = !!rawUrl && URL_LINK_STRICT.test(rawUrl) && !rawUrl.startsWith('//');
  const base = safe ? rawUrl : REGISTRATION_DEFAULT_URL;
  const ref = typeof content.ref === 'string' ? content.ref.trim() : '';
  if (!ref) return base;
  if (base.startsWith('#') || base.startsWith('mailto:') || base.startsWith('tel:')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ref=${encodeURIComponent(ref)}`;
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
