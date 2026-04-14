import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';

/**
 * Resolve a sign-in identity (username or email) to an email address.
 * If the identity contains '@', it is treated as an email and returned as-is.
 * Otherwise, it is looked up as a username in the users table.
 *
 * @throws Error with message 'Invalid credentials' if username is not found.
 */
export async function resolveIdentityToEmail(db: DB, identity: string): Promise<string> {
  if (identity.includes('@')) {
    return identity;
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.username, identity), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  return user.email;
}
