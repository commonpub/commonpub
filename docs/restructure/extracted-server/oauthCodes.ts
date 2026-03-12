/** Database-backed authorization code store for OAuth2 flows.
 *  Codes are single-use with a 10-minute TTL.
 *  Safe for multi-process deployments.
 */

import { eq, and, lt } from 'drizzle-orm';
import { oauthCodes } from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type DB = NodePgDatabase<Record<string, unknown>>;

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Store an authorization code */
export async function storeAuthCode(
  db: DB,
  code: string,
  userId: string,
  clientId: string,
  redirectUri: string,
): Promise<void> {
  await db.insert(oauthCodes).values({
    code,
    userId,
    clientId,
    redirectUri,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
}

/** Consume an authorization code (single-use). Returns the stored data or null. */
export async function consumeAuthCode(
  db: DB,
  code: string,
  clientId: string,
  redirectUri: string,
): Promise<{ userId: string } | null> {
  // Delete and return in one operation for atomicity
  const deleted = await db
    .delete(oauthCodes)
    .where(eq(oauthCodes.code, code))
    .returning();

  if (deleted.length === 0) return null;

  const stored = deleted[0]!;

  if (new Date() > stored.expiresAt) return null;
  if (stored.clientId !== clientId) return null;
  if (stored.redirectUri !== redirectUri) return null;

  return { userId: stored.userId };
}

/** Clean up expired codes */
export async function cleanupExpiredCodes(db: DB): Promise<void> {
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()));
}
