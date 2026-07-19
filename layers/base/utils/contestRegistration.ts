// The default registration template + `effectiveRegistrationTemplate` now live in
// @commonpub/schema so Nitro server routes can import them too (they don't auto-import
// from this `utils/` dir). Re-exported here so client components keep their auto-import.
export { DEFAULT_REGISTRATION_TEMPLATE, effectiveRegistrationTemplate } from '@commonpub/schema';
