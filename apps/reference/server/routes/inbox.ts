import { processInboxActivity } from '@commonpub/protocol';
import { createInboxHandlers } from '@commonpub/server';
import { verifyInboxRequest, extractDomain } from '../utils/inbox';

export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // Verify signature, domain, date freshness, body size
  const { body } = await verifyInboxRequest(event, 'shared-inbox');

  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);
  const callbacks = createInboxHandlers({ db, domain });

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
