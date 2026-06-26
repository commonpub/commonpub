/**
 * Referral shortcode generation (session 229). Random over a reduced
 * human-friendly alphabet (Crockford-style base32 minus `0 1 i l o u` to avoid
 * visual ambiguity + accidental profanity). Uniqueness is enforced by the DB
 * UNIQUE index, not a read-then-write check — callers INSERT with
 * `onConflictDoNothing` and retry on an empty result (see links.ts). With a
 * ~30^8 namespace, a retry is vanishingly rare.
 */
export const REFERRAL_CODE_ALPHABET = '23456789abcdefghjkmnpqrstvwxyz';
export const REFERRAL_CODE_LENGTH = 8;
export const CODE_MAX_ATTEMPTS = 5;

export function generateReferralCode(): string {
  let out = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  }
  return out;
}
