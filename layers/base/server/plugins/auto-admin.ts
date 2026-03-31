/**
 * Admin bootstrap plugin.
 *
 * In development: promotes the first registered user to admin.
 * In production: promotes ADMIN_BOOTSTRAP_USER (env var) if no admin exists.
 *
 * This solves the bootstrap problem where no admin exists to promote users.
 * The production path only runs ONCE (when admin count is 0) and requires
 * an explicit env var, so it's safe to leave enabled.
 */
import { users } from '@commonpub/schema';
import { eq, asc, count } from 'drizzle-orm';

export default defineNitroPlugin((nitro) => {
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

      // No admins exist — bootstrap one

      // Production: promote specific user from env var
      const bootstrapUsername = process.env.ADMIN_BOOTSTRAP_USER;
      if (process.env.NODE_ENV === 'production' && !bootstrapUsername) return;

      let targetUser: { id: string; username: string } | undefined;

      if (bootstrapUsername) {
        // Promote the specified user
        const [found] = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(eq(users.username, bootstrapUsername))
          .limit(1);
        targetUser = found;
        if (!targetUser) {
          console.warn(`[auto-admin] ADMIN_BOOTSTRAP_USER="${bootstrapUsername}" not found`);
        }
      } else {
        // Dev mode: promote first registered user
        const [firstUser] = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .orderBy(asc(users.createdAt))
          .limit(1);
        targetUser = firstUser;
      }

      if (!targetUser) return;

      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, targetUser.id));

      console.log(`[auto-admin] Promoted "${targetUser.username}" to admin`);
    } catch {
      // DB not ready yet — safe to ignore, will work on next restart
    }
  }, 2000);
});
