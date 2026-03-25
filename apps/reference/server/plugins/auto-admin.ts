/**
 * Dev-only plugin: promotes the first registered user to admin.
 * Solves the bootstrap problem where no admin exists to promote users.
 * Only runs in development mode.
 */
import { users } from '@commonpub/schema';
import { eq, asc, count } from 'drizzle-orm';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'production') return;

  // Run after a short delay so the DB pool is ready
  setTimeout(async () => {
    try {
      const db = useDB();

      // Count admin users
      const [adminCount] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, 'admin'));

      if (adminCount && adminCount.count > 0) return;

      // No admins — find the first registered user
      const [firstUser] = await db
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .orderBy(asc(users.createdAt))
        .limit(1);

      if (!firstUser) return; // no users yet — will retry on next restart

      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, firstUser.id));

      console.log(`[auto-admin] Promoted "${firstUser.username}" to admin (first user, dev mode)`);
    } catch {
      // DB not ready yet — safe to ignore, user can restart
    }
  }, 2000);
});
