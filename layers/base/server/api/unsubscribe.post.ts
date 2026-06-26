import { verifyUnsubscribeToken } from '@commonpub/server';
import { users } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/unsubscribe?token=...   (one-click List-Unsubscribe, no body → scope 'all')
 * POST /api/unsubscribe  { token, scope: 'digest' | 'all' }   (the /unsubscribe page)
 *
 * Token-authenticated (HMAC over the user id) — deliberately usable cross-origin
 * from a mail client, so it carries no session cookie and the CSRF middleware
 * passes it through. The token is the authorization; unsubscribing is low-harm and
 * reversible in settings.
 */
export default defineEventHandler(async (event): Promise<{ ok: true; scope: 'digest' | 'all'; username: string }> => {
  const db = useDB();
  const secret = (useRuntimeConfig().authSecret as string) || '';
  const query = getQuery(event);
  const body = (await readBody(event).catch(() => null)) as { token?: string; scope?: string } | null;

  const token =
    (typeof query.token === 'string' && query.token) ||
    (body && typeof body.token === 'string' ? body.token : '');
  const scope: 'digest' | 'all' = body?.scope === 'digest' ? 'digest' : 'all';

  const userId = token ? verifyUnsubscribeToken(token, secret) : null;
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired unsubscribe link' });
  }

  const [row] = await db
    .select({ prefs: users.emailNotifications, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  // Merge so other notification toggles aren't clobbered.
  const current = row.prefs ?? {};
  const next =
    scope === 'digest'
      ? { ...current, digest: 'none' as const }
      : { ...current, digest: 'none' as const, unsubscribedAll: true };

  await db.update(users).set({ emailNotifications: next }).where(eq(users.id, userId));

  return { ok: true, scope, username: row.username };
});
