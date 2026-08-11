// The default registration template + `effectiveRegistrationTemplate` now live in
// @commonpub/schema so Nitro server routes can import them too (they don't auto-import
// from this `utils/` dir). Re-exported here so client components keep their auto-import.
export { DEFAULT_REGISTRATION_TEMPLATE, effectiveRegistrationTemplate } from '@commonpub/schema';

import type { FormField } from '@commonpub/schema';
import { templateHasRequiredField } from '@commonpub/schema';

/**
 * "Rich" registration form = one that must NOT render inline in the ~300px signup
 * sidebar. Rich forms open on the dedicated `/contests/:slug/register` page; short
 * forms open in a modal; the bare default (no required fields) stays a one-click
 * register with no form at all. A form is rich when the operator has grouped it into
 * sections, added a room-hungry type (address / file / signature), stacked two or more
 * agreements, or asks more than a handful of questions.
 */
export function isRichRegistrationForm(template: FormField[] | null | undefined): boolean {
  const fields = template ?? [];
  if (fields.some((f) => f.type === 'section')) return true;
  if (fields.some((f) => f.type === 'address' || f.type === 'file' || f.type === 'signature')) return true;
  if (fields.filter((f) => f.type === 'agreement').length >= 2) return true;
  return fields.filter((f) => f.type !== 'section').length > 5;
}

/** What pressing a "Register" control should actually do. */
export type RegistrationAction =
  /** Anonymous: send to sign-in, returning to the registration form. */
  | { kind: 'login'; to: string }
  /** A form must be filled in and it is too big for a sidebar modal. */
  | { kind: 'page'; to: string }
  /** A short but required form — fine in a modal, where the caller has one. */
  | { kind: 'modal' }
  /** Nothing required: register in one click. */
  | { kind: 'register' };

export interface RegistrationActionInput {
  slug: string;
  isAuthenticated: boolean;
  template: FormField[] | null | undefined;
  /** Whether the CALLER can host a modal. The sidebar card can; the hero, the
   *  action bar and the entries CTA cannot, and route to the page instead. */
  allowModal?: boolean;
}

/**
 * The single decision for every "Register" control on a contest page.
 *
 * Before this existed the page and the signup card each had their own version
 * and they disagreed in ways users could see (session 253):
 *  - The card had no anonymous branch at all — it relied on a template `v-if`,
 *    so any new caller copying its logic shipped an anonymous hole.
 *  - For a short-but-required form the card opened a MODAL while the hero
 *    navigated to the full page, so the same contest gave the same viewer two
 *    different UIs depending on which identically-labelled button they pressed.
 *  - Only the card consulted `isRichRegistrationForm`; the page never did.
 *
 * Callers switch on `kind` and do the navigation/emit themselves, so this stays
 * pure and testable and no caller can quietly grow a fourth variant.
 */
export function resolveRegistrationAction(input: RegistrationActionInput): RegistrationAction {
  const { slug, isAuthenticated, template, allowModal = false } = input;
  const registerPath = `/contests/${slug}/register`;

  // Anonymous first: land them IN the form after sign-in, not back on the
  // contest page still unregistered. The route's `auth` middleware round-trips.
  if (!isAuthenticated) return { kind: 'login', to: `/auth/login?redirect=${registerPath}` };

  // Nothing is required, so there is nothing to show: one click registers.
  if (!templateHasRequiredField(template ?? [])) return { kind: 'register' };

  // Something is required. A rich form never fits a 300px sidebar modal, and a
  // caller with nowhere to put a modal always uses the page.
  if (!allowModal || isRichRegistrationForm(template)) return { kind: 'page', to: registerPath };
  return { kind: 'modal' };
}
