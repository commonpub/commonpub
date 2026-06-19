import { processInboxActivity } from '@commonpub/protocol';
import { createInboxHandlers, recordActivitySeen } from '@commonpub/server';
import { verifyInboxRequest, assertActorMatchesSigner } from '../../../utils/inbox';

/**
 * Hub-specific inbox endpoint (FEP-1b12).
 * Receives activities directed at the hub Group actor.
 * Delegates to the same inbox handlers as the shared inbox.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // Verify signature, domain, date freshness, body size
  const { actorUri, body } = await verifyInboxRequest(event, 'hub-inbox');
  assertActorMatchesSigner(actorUri, body, 'hub-inbox');

  const db = useDB();

  // Replay dedup: claim the verified activity id BEFORE dispatch so a replayed,
  // validly-signed activity can't double-apply side effects. No id = process
  // normally. Placed after verification so attacker-chosen ids can't be seeded.
  const activityId = body.id;
  if (typeof activityId === 'string' && activityId.length > 0) {
    const first = await recordActivitySeen(db, activityId);
    if (!first) {
      return { status: 'accepted' };
    }
  }

  const domain = config.instance.domain;
  const slug = getRouterParam(event, 'slug');
  const handlers = createInboxHandlers({ db, domain, hubContext: slug ? { hubSlug: slug } : undefined });

  try {
    await processInboxActivity(body, handlers);
    return { status: 'accepted' };
  } catch (err) {
    console.error('[hub-inbox] Activity processing error:', err);
    throw createError({ statusCode: 400, statusMessage: 'Activity processing failed' });
  }
});
