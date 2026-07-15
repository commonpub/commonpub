import { countBroadcastRecipients } from '@commonpub/server';
import { broadcastAudienceSchema } from '@commonpub/schema';

/**
 * POST /api/admin/broadcast/recipients — estimated recipient count for an
 * audience (verified, not unsubscribed), so the composer can show it before send.
 * Body is the audience value ('all' | { role } | { userIds }).
 */
export default defineEventHandler(async (event): Promise<{ count: number }> => {
  requireFeature('admin');
  requirePermission(event, 'broadcast.send');
  const audience = await parseBody(event, broadcastAudienceSchema);
  return { count: await countBroadcastRecipients(useDB(), audience, useConfig().features.emailUnverified) };
});
