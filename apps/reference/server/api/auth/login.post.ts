import { eq, and, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';

/**
 * Login endpoint that accepts username OR email.
 * Resolves username to email server-side, then delegates to Better Auth.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { identity, password } = body as { identity: string; password: string };

  if (!identity || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Username/email and password required' });
  }

  let email = identity;

  // If no @ sign, treat as username and resolve to email
  if (!identity.includes('@')) {
    const db = useDB();
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.username, identity), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
    }
    email = user.email;
  }

  // Forward to Better Auth's email sign-in
  const response = await $fetch('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password },
    headers: Object.fromEntries(
      Object.entries(getRequestHeaders(event)).filter(([, v]) => v !== undefined) as [string, string][],
    ),
  });

  return response;
});
