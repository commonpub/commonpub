/**
 * Admin bootstrap plugin.
 *
 * Runs once when no admin exists yet:
 *
 *   - Development (NODE_ENV !== 'production'): promotes the first
 *     registered user to admin. Zero config.
 *   - Production, ADMIN_BOOTSTRAP_USER set: promotes that username.
 *     The canonical "set the admin directly" path.
 *   - Production, ADMIN_BOOTSTRAP_FIRST_USER truthy (1/true/yes):
 *     promotes the first registered user — the frictionless
 *     one-click-deploy path (deploy → register → you're admin).
 *   - Production, neither set: does nothing (safe default — a public
 *     instance shouldn't hand admin to a random first signup unless
 *     the operator explicitly opted in).
 *
 * Idempotent: the whole block early-returns once any admin exists, so
 * this is safe to leave enabled forever and ships harmlessly to
 * instances that already have admins (no behavior change there).
 */
import { users } from '@commonpub/schema';
import { eq, asc, count } from 'drizzle-orm';

/** Truthy env check — accepts 1/true/yes (case-insensitive). */
function envTruthy(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(value ?? '');
}

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

      const bootstrapUsername = process.env.ADMIN_BOOTSTRAP_USER;
      const isProd = process.env.NODE_ENV === 'production';
      // First-user promotion: default in dev, opt-in in prod via
      // ADMIN_BOOTSTRAP_FIRST_USER (the one-click-deploy path).
      const allowFirstUser = !isProd || envTruthy(process.env.ADMIN_BOOTSTRAP_FIRST_USER);

      // In production, do nothing unless the operator either named a
      // user OR explicitly opted into first-user promotion. Preserves
      // the original safe default for instances that set neither.
      if (isProd && !bootstrapUsername && !allowFirstUser) return;

      let targetUser: { id: string; username: string } | undefined;

      if (bootstrapUsername) {
        // Promote the specified user (canonical "set admin directly").
        const [found] = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(eq(users.username, bootstrapUsername))
          .limit(1);
        targetUser = found;
        if (!targetUser) {
          console.warn(`[auto-admin] ADMIN_BOOTSTRAP_USER="${bootstrapUsername}" not found`);
        }
      } else if (allowFirstUser) {
        // Promote the first registered user (dev always; prod only
        // when ADMIN_BOOTSTRAP_FIRST_USER opted in).
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
