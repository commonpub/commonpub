/**
 * Notification email plugin.
 * - Registers an instant email sender so createNotification() can fire emails.
 * - Runs a digest scheduler that batches unread notifications for users who prefer daily/weekly digests.
 */
import {
  setNotificationEmailSender,
  shouldEmailNotification,
  getNotificationEmailTarget,
  emailTemplates,
  listNotifications,
} from '@commonpub/server';
import type { NotificationType } from '@commonpub/server';
import { users } from '@commonpub/schema';
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

      // Register instant email sender.
      // Uses useDB() instead of the passed db because createNotification() may be
      // called inside a transaction — the fire-and-forget callback would run after
      // the transaction commits, making the transaction-scoped db handle stale.
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

        const emailAdapter = useEmailAdapter();
        const template = emailTemplates.notificationInstant(
          siteName,
          target.username,
          {
            title: notification.title,
            message: notification.message,
            url: notification.link ? `${siteUrl}${notification.link}` : siteUrl,
          },
        );
        await emailAdapter.send({ ...template, to: target.email });
      });

      console.log('[notification-email] Instant email sender registered');

      // Digest scheduler — runs every hour, sends digests for users whose digest window has elapsed
      const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
      digestInterval = setInterval(() => {
        runDigest(siteUrl, siteName).catch((err) => {
          console.error('[notification-email] Digest scheduler unexpected error:', err instanceof Error ? err.message : err);
        });
      }, DIGEST_INTERVAL_MS);

      console.log('[notification-email] Digest scheduler started (interval: 1h)');
    } catch (err) {
      console.error('[notification-email] Failed to start:', err instanceof Error ? err.message : err);
    }
  }, 5_000);

  async function runDigest(siteUrl: string, siteName: string): Promise<void> {
    try {
      const db = useDB();
      const now = new Date();
      const hour = now.getUTCHours();

      // Daily digests go out at 8am UTC; weekly digests go out Monday at 8am UTC
      const isDigestHour = hour === 8;
      const isMonday = now.getUTCDay() === 1;

      if (!isDigestHour) return;

      // Find users with digest preferences
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

      const emailAdapter = useEmailAdapter();
      let sent = 0;

      for (const user of digestUsers) {
        const prefs = user.emailNotifications as { digest?: string } | null;
        if (!prefs?.digest) continue;
        if (prefs.digest === 'none') continue;
        if (prefs.digest === 'weekly' && !isMonday) continue;

        // Get unread notifications from the last digest period
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

        // Filter to only notifications within the digest window
        const recent = items.filter((n) => n.createdAt >= since);
        if (recent.length === 0) continue;

        const template = emailTemplates.notificationDigest(
          siteName,
          user.username,
          recent.map((n) => ({
            text: `${n.title}: ${n.message}`,
            url: n.link ? `${siteUrl}${n.link}` : siteUrl,
          })),
        );

        try {
          await emailAdapter.send({ ...template, to: user.email });
          sent++;
        } catch (err) {
          console.error(`[notification-email] Digest failed for ${user.username}:`, err instanceof Error ? err.message : err);
        }
      }

      if (sent > 0) {
        console.log(`[notification-email] Sent ${sent} digest email(s)`);
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
