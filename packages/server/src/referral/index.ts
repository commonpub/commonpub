// Referral links (session 229) — user-owned signup attribution + bounded
// onboarding actions. Instance-local; never federates. See
// docs/plans/referral-links.md.

export {
  generateReferralCode,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  CODE_MAX_ATTEMPTS,
} from './codes.js';
export { validateReferralActions, runReferralActions } from './actions.js';
export {
  createReferralLink,
  listMyReferralLinks,
  getReferralLink,
  updateReferralLink,
  deleteReferralLink,
} from './links.js';
export type { CreateReferralLinkResult, UpdateReferralLinkResult } from './links.js';
export { claimReferral, resolveReferral, recordReferralClick } from './attribution.js';
export type { ClaimResult, ResolvedReferral } from './attribution.js';
