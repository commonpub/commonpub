import { processInboxActivity } from '@commonpub/protocol';
import { createInboxHandlers } from '@commonpub/server';
import { verifyInboxRequest } from '../../../utils/inbox';

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
  const { body } = await verifyInboxRequest(event, 'hub-inbox');

  const db = useDB();
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
