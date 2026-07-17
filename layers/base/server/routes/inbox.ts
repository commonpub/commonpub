import { processInboxActivity } from '@commonpub/protocol';
import { createInboxHandlers, recordActivitySeen } from '@commonpub/server';
import { verifyInboxRequest, assertActorMatchesSigner, extractDomain } from '../utils/inbox';

export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // Verify signature, domain, date freshness, body size
  const { actorUri, body } = await verifyInboxRequest(event, 'shared-inbox');
  // Bind the activity's actor to the verified signer (anti-spoofing).
  assertActorMatchesSigner(actorUri, body, 'shared-inbox');

  const db = useDB();

  // Replay dedup: claim the verified activity id BEFORE dispatch so a replayed,
  // validly-signed activity can't double-apply side effects. No id = process
  // normally (can't dedup what isn't addressable). Placed after verification so
  // attacker-chosen ids can't be seeded.
  const activityId = body.id;
  if (typeof activityId === 'string' && activityId.length > 0) {
    const first = await recordActivitySeen(db, activityId);
    if (!first) {
      return { status: 'accepted' };
    }
  }

  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);
  const callbacks = createInboxHandlers({ db, domain, federationConfig: config.federation });

  try {
    const result = await processInboxActivity(body, callbacks);
    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.error ?? 'Invalid activity' });
    }
    return { status: 'accepted' };
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    console.error('[shared-inbox]', err);
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity' });
  }
});
