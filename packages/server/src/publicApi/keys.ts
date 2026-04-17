import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Raw-token format: `cpub_<env>_<type>_<32 random bytes base64url>`.
 *
 * - Prefix is fixed at 16 chars so every key has the same indexable head;
 *   secret scanners (GitGuardian, Gitleaks) recognise the literal.
 * - 32 random bytes → 256 bits entropy → SHA-256 for storage is fine
 *   (bcrypt's KDF cost only matters for low-entropy user-chosen secrets).
 */
const PREFIX_BASE = 'cpub_live_ak_';
const PREFIX_LENGTH = 16;

export interface GeneratedKey {
  /** Raw token shown to the admin ONCE. Never store this. */
  token: string;
  /** First 16 chars of the token — index column for O(1) lookup. */
  prefix: string;
  /** SHA-256 hex digest of the full token. Stored in DB. */
  keyHash: string;
}

export function generateApiKey(): GeneratedKey {
  const random = randomBytes(32).toString('base64url');
  const token = `${PREFIX_BASE}${random}`;
  const prefix = token.slice(0, PREFIX_LENGTH);
  const keyHash = hashApiKey(token);
  return { token, prefix, keyHash };
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time hex-digest comparison. Reject length mismatches early (the
 * length itself is not secret, so a short-circuit there doesn't leak
 * anything). If the digests differ in length something is already wrong, so
 * returning false without the compare is fine.
 */
export function compareKeyHash(providedHex: string, storedHex: string): boolean {
  if (providedHex.length !== storedHex.length) return false;
  const a = Buffer.from(providedHex, 'hex');
  const b = Buffer.from(storedHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractPrefix(token: string | undefined | null): string | null {
  if (typeof token !== 'string') return null;
  if (!token.startsWith(PREFIX_BASE)) return null;
  if (token.length < PREFIX_LENGTH + 16) return null;
  return token.slice(0, PREFIX_LENGTH);
}
