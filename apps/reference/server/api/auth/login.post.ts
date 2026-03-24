import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';

/**
 * Resolve identity (username or email) to an email address.
 * The client then uses the resolved email to call Better Auth's sign-in directly.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { identity } = body as { identity: string };

  if (!identity) {
    throw createError({ statusCode: 400, statusMessage: 'Username or email required' });
  }

  // If it looks like an email, return it directly
  if (identity.includes('@')) {
    return { email: identity };
  }

  // Otherwise resolve username to email
  const db = useDB();
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.username, identity), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
  }

  return { email: user.email };
});
