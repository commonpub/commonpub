import { sendBroadcast } from '@commonpub/server';
import { broadcastInputSchema } from '@commonpub/schema';

/**
 * POST /api/admin/broadcast — send an operator-composed email to an audience
 * (all / by-role / specific users), via the durable outbox. Recipients are always
 * email-verified and not globally unsubscribed; each email carries a one-click
 * unsubscribe. Gated by the adminBroadcast flag + the broadcast.send permission.
 */
export default defineEventHandler(async (event): Promise<{ broadcastId: string; recipientCount: number }> => {
  requireFeature('admin');
  requireFeature('adminBroadcast');
  const admin = requirePermission(event, 'broadcast.send');
  const db = useDB();
  const config = useConfig();
  const rc = useRuntimeConfig();
  const siteUrl = (rc.public?.siteUrl as string) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || 'CommonPub';
  const secret = (rc.authSecret as string) || '';

  const input = await parseBody(event, broadcastInputSchema);
  return await sendBroadcast(db, { ...input, sentBy: admin.id, siteName, siteUrl, secret }, config.features.emailUnverified);
});
