import { apiKeys, type ApiKey } from '@commonpub/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '../types.js';
import { compareKeyHash, extractPrefix, hashApiKey } from './keys.js';

export type AuthFailure =
  | 'missing'
  | 'malformed'
  | 'not_found'
  | 'expired'
  | 'revoked';

export interface AuthSuccess {
  ok: true;
  key: ApiKey;
}

export interface AuthRejected {
  ok: false;
  reason: AuthFailure;
}

export type AuthResult = AuthSuccess | AuthRejected;

/**
 * Validate a raw Bearer token and return the matching key row, or a tagged
 * failure reason. The caller maps reasons to HTTP status codes (we always
 * return 401 for all lookup failures at the edge — the reason tag is for
 * internal logging, never echoed to the caller).
 *
 * Important safety points:
 * - Prefix lookup is O(1) (indexed), but the hash comparison is O(n) on a
 *   fixed-size buffer — constant-time via timingSafeEqual.
 * - We reject before the DB query if the token doesn't match the `cpub_*`
 *   format. That saves a round-trip for obvious junk and makes logs cleaner.
 */
export async function authenticateApiKey(db: DB, rawToken: string | undefined): Promise<AuthResult> {
  if (!rawToken) return { ok: false, reason: 'missing' };

  const prefix = extractPrefix(rawToken);
  if (!prefix) return { ok: false, reason: 'malformed' };

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return { ok: false, reason: 'not_found' };

  const providedHash = hashApiKey(rawToken);
  if (!compareKeyHash(providedHash, row.keyHash)) return { ok: false, reason: 'not_found' };

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, key: row };
}
