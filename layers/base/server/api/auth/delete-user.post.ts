import { deleteUser, federateDelete } from '@commonpub/server';
import { contentItems } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event): Promise<{ success: true }> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  // Prevent deleting the last admin
  if (user.role === 'admin') {
    const { users } = await import('@commonpub/schema');
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(2);
    if (admins.length <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete the only admin account',
      });
    }
  }

  // Federation cleanup: send Delete activities for published content
  if (config.features.federation) {
    const domain = config.instance.domain;
    if (domain) {
      const published = await db
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(and(
          eq(contentItems.authorId, user.id),
          eq(contentItems.status, 'published'),
        ));

      for (const item of published) {
        try {
          await federateDelete(db, item.id, domain, user.username);
        } catch {
          // Best-effort — don't block deletion if federation fails
        }
      }
    }
  }

  // Delete the user (cascades to all related data)
  await deleteUser(db, user.id, user.id);

  // Clear the session cookie
  deleteCookie(event, 'better-auth.session_token', { path: '/' });

  return { success: true };
});
