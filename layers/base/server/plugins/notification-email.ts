/**
 * Notification email producer plugin (email Phase 1).
 * - Registers an instant email sender so createNotification() can ENQUEUE emails.
 * - Runs a digest scheduler that batches unread notifications into ENQUEUED emails
 *   for users who prefer daily/weekly digests.
 *
 * This plugin PRODUCES `email_outbox` rows; the email-outbox.ts worker delivers
 * them (throttled, batched, retrying). Nothing here sends a provider request
 * directly. Auth mail (verify/reset) is unaffected — it sends directly elsewhere.
 */
import {
  setNotificationEmailSender,
  shouldEmailNotification,
  getNotificationEmailTarget,
  emailTemplates,
  enqueueEmail,
  enqueueEmails,
  buildUnsubscribeLinks,
  getEmailBranding,
  listNotifications,
} from '@commonpub/server';
import type { NotificationType, OutboxMessage } from '@commonpub/server';
import { users, digestRuns } from '@commonpub/schema';
import { and, isNotNull, eq } from 'drizzle-orm';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let digestInterval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.emailNotifications) {
        console.log('[notification-email] Email notifications disabled');
        return;
      }

      const runtimeConfig = useRuntimeConfig();
      const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
      const siteName = config.instance.name || 'CommonPub';
      const secret = (runtimeConfig.authSecret as string) || '';

      // Per-recipient unsubscribe links (shared builder owns the URL/header shape).
      const unsubLinks = (userId: string) => buildUnsubscribeLinks(siteUrl, userId, secret);

      // Register instant email sender. Uses useDB() (not the passed db) because
      // createNotification() may run inside a transaction; the fire-and-forget
      // callback executes after commit, making a tx-scoped handle stale.
      setNotificationEmailSender(async (_db, notification) => {
        const freshDb = useDB();
        const should = await shouldEmailNotification(
          freshDb,
          notification.userId,
          notification.type as NotificationType,
        );
        if (!should) return;

        const target = await getNotificationEmailTarget(freshDb, notification.userId);
        if (!target) return;

        const { pageUrl, headers } = unsubLinks(notification.userId);
        const branding = await getEmailBranding(freshDb);
        const template = emailTemplates.notificationInstant(
          siteName,
          target.username,
          {
            title: notification.title,
            message: notification.message,
            url: notification.link ? `${siteUrl}${notification.link}` : siteUrl,
          },
          pageUrl,
          branding,
        );
        await enqueueEmail(freshDb, {
          toEmail: target.email,
          userId: notification.userId,
          subject: template.subject,
          html: template.html,
          text: template.text,
          headers,
          category: 'notification',
        });
      });

      console.log('[notification-email] Instant email sender registered (enqueue)');

      // Digest scheduler — runs hourly, enqueues digests at the digest hour.
      const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
      digestInterval = setInterval(() => {
        runDigest(siteUrl, siteName, unsubLinks).catch((err) => {
          console.error('[notification-email] Digest scheduler unexpected error:', err instanceof Error ? err.message : err);
        });
      }, DIGEST_INTERVAL_MS);

      console.log('[notification-email] Digest scheduler started (interval: 1h)');
    } catch (err) {
      console.error('[notification-email] Failed to start:', err instanceof Error ? err.message : err);
    }
  }, 5_000);

  // Cheap in-process pre-check to avoid hitting the DB once this replica has already
  // observed today's digest as claimed. The DB claim (digest_runs) is the authority.
  let lastDigestDate = '';

  async function runDigest(
    siteUrl: string,
    siteName: string,
    unsubLinks: (userId: string) => { pageUrl: string; headers: Record<string, string> },
  ): Promise<void> {
    try {
      const db = useDB();
      const now = new Date();
      const hour = now.getUTCHours();

      // Daily digests go out at 8am UTC; weekly digests go out Monday at 8am UTC
      const isDigestHour = hour === 8;
      const isMonday = now.getUTCDay() === 1;

      if (!isDigestHour) return;

      const todayKey = now.toISOString().slice(0, 10);
      if (lastDigestDate === todayKey) return;

      // Atomic cross-replica claim: exactly one replica wins the day.
      const claimed = await db
        .insert(digestRuns)
        .values({ digestDate: todayKey })
        .onConflictDoNothing({ target: digestRuns.digestDate })
        .returning({ digestDate: digestRuns.digestDate });

      lastDigestDate = todayKey;
      if (claimed.length === 0) return; // another replica already claimed today

      const digestUsers = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          emailNotifications: users.emailNotifications,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(and(
          isNotNull(users.emailNotifications),
          eq(users.emailVerified, true),
        ));

      const messages: OutboxMessage[] = [];
      const branding = await getEmailBranding(db);

      for (const user of digestUsers) {
        const prefs = user.emailNotifications as { digest?: string; unsubscribedAll?: boolean } | null;
        if (!prefs?.digest) continue;
        if (prefs.digest === 'none') continue;
        if (prefs.unsubscribedAll) continue; // hard opt-out
        if (prefs.digest === 'weekly' && !isMonday) continue;

        const since = new Date(now);
        if (prefs.digest === 'daily') {
          since.setDate(since.getDate() - 1);
        } else {
          since.setDate(since.getDate() - 7);
        }

        const { items } = await listNotifications(db, {
          userId: user.id,
          read: false,
          limit: 50,
        });

        const recent = items.filter((n) => n.createdAt >= since);
        if (recent.length === 0) continue;

        const { pageUrl, headers } = unsubLinks(user.id);
        const template = emailTemplates.notificationDigest(
          siteName,
          user.username,
          recent.map((n) => ({
            text: `${n.title}: ${n.message}`,
            url: n.link ? `${siteUrl}${n.link}` : siteUrl,
          })),
          pageUrl,
          branding,
        );
        messages.push({
          toEmail: user.email,
          userId: user.id,
          subject: template.subject,
          html: template.html,
          text: template.text,
          headers,
          category: 'digest',
        });
      }

      // One bulk insert; the outbox worker delivers them throttled/batched.
      await enqueueEmails(db, messages);
      if (messages.length > 0) {
        console.log(`[notification-email] Enqueued ${messages.length} digest email(s)`);
      }
    } catch (err) {
      console.error('[notification-email] Digest scheduler error:', err instanceof Error ? err.message : err);
    }
  }

  nitro.hooks.hook('close', () => {
    clearTimeout(startupTimer);
    if (digestInterval) {
      clearInterval(digestInterval);
      digestInterval = null;
    }
  });
});
