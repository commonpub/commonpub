import { processInboxActivity } from '@commonpub/protocol';
import { createInboxHandlers } from '@commonpub/server';
import { verifyInboxRequest, assertActorMatchesSigner, extractDomain, processActivityOnce } from '../utils/inbox';

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

  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);
  const callbacks = createInboxHandlers({ db, domain, federationConfig: config.federation });

  // Claimed once (replay-safe), released for a retry if processing fails.
  return processActivityOnce(db, body.id, 'shared-inbox', async () => {
    const result = await processInboxActivity(body, callbacks);
    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.error ?? 'Invalid activity' });
    }
  });
});
