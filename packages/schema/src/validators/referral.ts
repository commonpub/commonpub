import { z } from 'zod';

// Referral links (session 229). All write-shapes are validated here; the table
// in ../referral.ts imports `ReferralAction` for its jsonb `$type`. `.strict()`
// everywhere so an unknown key in an action object is rejected, not silently
// stored. See docs/plans/referral-links.md.

/**
 * Codes that would collide with a top-level route or are otherwise unsafe as a
 * custom slug. Matched against the lowercased code. Keep in sync with the real
 * route tree (and the short-link prefix `/r`).
 */
export const RESERVED_REFERRAL_CODES = new Set<string>([
  'admin', 'api', 'auth', 'r', 'u', 'hubs', 'hub', 'settings', 'dashboard',
  'login', 'logout', 'register', 'signup', 'signin', 'search', 'about', 'help',
  'docs', 'doc', 'explore', 'feed', 'new', 'edit', 'me', 'profile', 'users',
  'content', 'projects', 'blog', 'explainers', 'contests', 'events', 'learn',
  'video', 'videos', 'referrals', 'referral', 'unsubscribe', 'terms', 'privacy',
]);

// Tiny local profanity blocklist (substring, case-insensitive). Copied here on
// purpose so an upstream package update can't silently change what we reject.
const PROFANITY = [
  'fuck', 'shit', 'cunt', 'nigger', 'faggot', 'bitch', 'asshole', 'whore', 'rape',
];

function containsProfanity(s: string): boolean {
  const lower = s.toLowerCase();
  return PROFANITY.some((w) => lower.includes(w));
}

/**
 * A referral code: 3-40 chars, letters/numbers/hyphens, must start
 * alphanumeric. Normalized to lowercase (codes are case-insensitive and stored
 * lowercased). Rejects reserved route names and obvious profanity. Used for both
 * user-chosen custom codes and parsing an incoming code on the claim path.
 */
export const referralCodeSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(40, 'At most 40 characters')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/, 'Use letters, numbers and hyphens; must start with a letter or number')
  .transform((s) => s.toLowerCase())
  .refine((s) => !RESERVED_REFERRAL_CODES.has(s), 'That code is reserved')
  .refine((s) => !containsProfanity(s), 'That code is not allowed');

/**
 * A same-origin relative path used for the post-signup redirect. Must be a path
 * on this site (open-redirect guard): starts with a single `/`, no scheme, no
 * protocol-relative `//`, no backslashes, no whitespace or control characters.
 */
export const referralRedirectPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (p) =>
      p.startsWith('/') &&
      !p.startsWith('//') &&
      !p.includes('\\') &&
      ![...p].some((c) => c.charCodeAt(0) <= 0x20),
    'Must be a path on this site (start with /)',
  );

/**
 * The bounded onboarding-action vocabulary (plan §6). A discriminated union, so
 * adding a new action type is an additive change here + a branch in the executor
 * — never a schema migration. The action always references an existing entity
 * (a hub id, a relative path), never executable logic.
 */
export const referralActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join_hub'), hubId: z.string().uuid() }).strict(),
  z.object({ type: z.literal('redirect'), path: referralRedirectPathSchema }).strict(),
]);

export type ReferralAction = z.infer<typeof referralActionSchema>;

export const referralActionsSchema = z.array(referralActionSchema).max(10, 'Too many actions');

export const createReferralLinkSchema = z
  .object({
    // Omit to auto-generate a conflict-free code.
    code: referralCodeSchema.optional(),
    label: z.string().trim().max(80).optional(),
    actions: referralActionsSchema.default([]),
    landingPath: referralRedirectPathSchema.optional(),
    attributionWindowDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

export const updateReferralLinkSchema = z
  .object({
    label: z.string().trim().max(80).nullable().optional(),
    actions: referralActionsSchema.optional(),
    landingPath: referralRedirectPathSchema.nullable().optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .strict();

export type CreateReferralLinkInput = z.infer<typeof createReferralLinkSchema>;
export type UpdateReferralLinkInput = z.infer<typeof updateReferralLinkSchema>;
