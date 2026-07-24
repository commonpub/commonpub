// The default registration template + `effectiveRegistrationTemplate` now live in
// @commonpub/schema so Nitro server routes can import them too (they don't auto-import
// from this `utils/` dir). Re-exported here so client components keep their auto-import.
export { DEFAULT_REGISTRATION_TEMPLATE, effectiveRegistrationTemplate } from '@commonpub/schema';

import type { FormField } from '@commonpub/schema';

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
