import { processInboxActivity, verifyHttpSignature, resolveActor } from '@commonpub/protocol';
import { createInboxHandlers } from '@commonpub/server';

/**
 * Hub-specific inbox endpoint (FEP-1b12).
 * Receives activities directed at the hub Group actor.
 * Delegates to the same inbox handlers as the shared inbox.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  const body = await readBody(event);
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity' });
  }

  // Verify HTTP Signature
  try {
    const rawRequest = toWebRequest(event);
    const signatureHeader = getRequestHeader(event, 'signature');
    if (!signatureHeader) {
      throw createError({ statusCode: 401, statusMessage: 'Missing HTTP Signature' });
    }

    const keyIdMatch = signatureHeader.match(/keyId="([^"]+)"/);
    if (!keyIdMatch?.[1]) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid signature header' });
    }

    const actorUri = keyIdMatch[1].replace(/#.*$/, '');
    const actor = await resolveActor(actorUri, fetch);
    if (!actor?.publicKey?.publicKeyPem) {
      throw createError({ statusCode: 401, statusMessage: 'Could not resolve actor key' });
    }

    const valid = await verifyHttpSignature(rawRequest, actor.publicKey.publicKeyPem);
    if (!valid) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid HTTP Signature' });
    }
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    console.error('[hub-inbox] Signature verification error:', err);
    throw createError({ statusCode: 401, statusMessage: 'Signature verification failed' });
  }

  // Process the activity through standard inbox handlers
  const db = useDB();
  const domain = config.instance.domain;
  const handlers = createInboxHandlers({ db, domain });

  try {
    await processInboxActivity(body, handlers);
    return { status: 'accepted' };
  } catch (err) {
    console.error('[hub-inbox] Activity processing error:', err);
    throw createError({ statusCode: 400, statusMessage: 'Activity processing failed' });
  }
});
