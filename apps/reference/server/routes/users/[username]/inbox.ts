import { processInboxActivity, verifyHttpSignature, resolveActor, type InboxCallbacks } from '@commonpub/protocol';

// Stub callbacks — federation inbound processing is not yet wired to DB operations.
const inboxCallbacks: InboxCallbacks = {
  async onFollow(actorUri, targetActorUri, activityId) {
    console.log('[user-inbox] Follow:', actorUri, '→', targetActorUri, activityId);
  },
  async onAccept(actorUri, objectId) {
    console.log('[user-inbox] Accept:', actorUri, objectId);
  },
  async onReject(actorUri, objectId) {
    console.log('[user-inbox] Reject:', actorUri, objectId);
  },
  async onUndo(actorUri, objectType, objectId) {
    console.log('[user-inbox] Undo:', actorUri, objectType, objectId);
  },
  async onCreate(actorUri, object) {
    console.log('[user-inbox] Create:', actorUri, (object as Record<string, unknown>).type);
  },
  async onUpdate(actorUri, object) {
    console.log('[user-inbox] Update:', actorUri, (object as Record<string, unknown>).type);
  },
  async onDelete(actorUri, objectId) {
    console.log('[user-inbox] Delete:', actorUri, objectId);
  },
  async onLike(actorUri, objectUri) {
    console.log('[user-inbox] Like:', actorUri, objectUri);
  },
  async onAnnounce(actorUri, objectUri) {
    console.log('[user-inbox] Announce:', actorUri, objectUri);
  },
};

/** Extract keyId from the Signature header to resolve the sender's public key */
function extractKeyId(signatureHeader: string): string | null {
  const match = signatureHeader.match(/keyId="([^"]+)"/);
  return match ? match[1] : null;
}

export default defineEventHandler(async (event) => {
  // Gate on federation feature flag
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const method = getMethod(event);
  if (method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // Verify HTTP Signature
  const signatureHeader = getHeader(event, 'signature');
  if (!signatureHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Missing HTTP Signature' });
  }

  const keyId = extractKeyId(signatureHeader);
  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Signature header: missing keyId' });
  }

  // keyId is typically "https://remote.example/users/alice#main-key" — strip the fragment to get the actor URI
  const actorUri = keyId.replace(/#.*$/, '');
  const actor = await resolveActor(actorUri, fetch);
  if (!actor?.publicKey?.publicKeyPem) {
    throw createError({ statusCode: 401, statusMessage: 'Could not resolve actor public key' });
  }

  const request = toWebRequest(event);
  const signatureValid = await verifyHttpSignature(request, actor.publicKey.publicKeyPem);
  if (!signatureValid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid HTTP Signature' });
  }

  const body = await readBody(event);

  try {
    const result = await processInboxActivity(body, inboxCallbacks);
    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.error ?? 'Invalid activity' });
    }
    return { status: 'accepted' };
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    console.error('[user-inbox]', err);
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity' });
  }
});
