import { processInboxActivity, type InboxCallbacks } from '@commonpub/protocol';

// Stub callbacks — federation inbound processing is not yet wired to DB operations.
// Each callback logs the activity for debugging; real implementations will
// resolve actors, persist follows, create local content mirrors, etc.
const inboxCallbacks: InboxCallbacks = {
  async onFollow(actorUri, targetActorUri, activityId) {
    console.log('[inbox] Follow:', actorUri, '→', targetActorUri, activityId);
  },
  async onAccept(actorUri, objectId) {
    console.log('[inbox] Accept:', actorUri, objectId);
  },
  async onReject(actorUri, objectId) {
    console.log('[inbox] Reject:', actorUri, objectId);
  },
  async onUndo(actorUri, objectType, objectId) {
    console.log('[inbox] Undo:', actorUri, objectType, objectId);
  },
  async onCreate(actorUri, object) {
    console.log('[inbox] Create:', actorUri, (object as Record<string, unknown>).type);
  },
  async onUpdate(actorUri, object) {
    console.log('[inbox] Update:', actorUri, (object as Record<string, unknown>).type);
  },
  async onDelete(actorUri, objectId) {
    console.log('[inbox] Delete:', actorUri, objectId);
  },
  async onLike(actorUri, objectUri) {
    console.log('[inbox] Like:', actorUri, objectUri);
  },
  async onAnnounce(actorUri, objectUri) {
    console.log('[inbox] Announce:', actorUri, objectUri);
  },
};

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  // TODO: Verify HTTP Signature before processing (P0 security issue)
  // const signatureValid = await verifyHttpSignature(event);
  // if (!signatureValid) {
  //   throw createError({ statusCode: 401, statusMessage: 'Invalid HTTP Signature' });
  // }

  const body = await readBody(event);

  try {
    const result = await processInboxActivity(body, inboxCallbacks);
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
