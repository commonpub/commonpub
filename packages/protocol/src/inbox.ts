export interface InboxResult {
  success: boolean;
  error?: string;
}

/** Callbacks for inbox processing — dependency-injected by the app */
export interface InboxCallbacks {
  onFollow: (actorUri: string, targetActorUri: string, activityId: string) => Promise<void>;
  onAccept: (actorUri: string, objectId: string) => Promise<void>;
  onReject: (actorUri: string, objectId: string) => Promise<void>;
  onUndo: (actorUri: string, objectType: string, objectId: string) => Promise<void>;
  onCreate: (actorUri: string, object: Record<string, unknown>) => Promise<void>;
  onUpdate: (actorUri: string, object: Record<string, unknown>) => Promise<void>;
  onDelete: (actorUri: string, objectId: string) => Promise<void>;
  onLike: (actorUri: string, objectUri: string) => Promise<void>;
  onAnnounce: (actorUri: string, objectUri: string) => Promise<void>;
  /**
   * Inbound consent-based mirror request (Phase 3). Optional: instances that don't implement it
   * reject the Offer as unsupported. `requesterActorUri` asked us (`targetActorUri`) to mirror them.
   */
  onMirrorRequest?: (
    requesterActorUri: string,
    targetActorUri: string,
    offerActivityId: string,
  ) => Promise<void>;
}

/** Route an inbound activity to the appropriate handler */
export async function processInboxActivity(
  activity: Record<string, unknown>,
  callbacks: InboxCallbacks,
): Promise<InboxResult> {
  const type = activity.type as string;
  // Normalize `actor` to its string id. AP allows actor to be a bare URI string
  // or an object `{ id }`; the inbox signature check (assertActorMatchesSigner)
  // already extracts `.id` from object-form actors, so if we passed the raw object
  // downstream, host-binding guards that do `new URL(actor)` would throw and
  // fail-open on a forged object-form actor. Extracting the id here keeps every
  // handler's actorUri a plain string. Array-form actor is unsupported (we cannot
  // bind a single signer host) and is rejected as a missing actor.
  const actor = extractActorId(activity.actor);

  if (!type || !actor) {
    return { success: false, error: 'Missing type or actor' };
  }

  switch (type) {
    case 'Follow': {
      const object = activity.object as string;
      if (!object) return { success: false, error: 'Follow missing object' };
      await callbacks.onFollow(actor, object, activity.id as string);
      return { success: true };
    }
    case 'Accept': {
      const objectId = extractObjectId(activity.object);
      if (!objectId) return { success: false, error: 'Accept missing object' };
      await callbacks.onAccept(actor, objectId);
      return { success: true };
    }
    case 'Reject': {
      const objectId = extractObjectId(activity.object);
      if (!objectId) return { success: false, error: 'Reject missing object' };
      await callbacks.onReject(actor, objectId);
      return { success: true };
    }
    case 'Undo': {
      const obj = activity.object;
      if (typeof obj === 'string') {
        await callbacks.onUndo(actor, 'unknown', obj);
      } else if (obj && typeof obj === 'object') {
        const inner = obj as Record<string, unknown>;
        await callbacks.onUndo(actor, inner.type as string, inner.id as string);
      } else {
        return { success: false, error: 'Undo missing object' };
      }
      return { success: true };
    }
    case 'Create': {
      const obj = activity.object;
      if (!obj || typeof obj !== 'object')
        return { success: false, error: 'Create missing object' };
      await callbacks.onCreate(actor, obj as Record<string, unknown>);
      return { success: true };
    }
    case 'Update': {
      const obj = activity.object;
      if (!obj || typeof obj !== 'object')
        return { success: false, error: 'Update missing object' };
      await callbacks.onUpdate(actor, obj as Record<string, unknown>);
      return { success: true };
    }
    case 'Delete': {
      const objectId = extractObjectId(activity.object);
      if (!objectId) return { success: false, error: 'Delete missing object' };
      await callbacks.onDelete(actor, objectId);
      return { success: true };
    }
    case 'Like': {
      const object = activity.object as string;
      if (!object) return { success: false, error: 'Like missing object' };
      await callbacks.onLike(actor, object);
      return { success: true };
    }
    case 'Announce': {
      const object = activity.object as string;
      if (!object) return { success: false, error: 'Announce missing object' };
      await callbacks.onAnnounce(actor, object);
      return { success: true };
    }
    case 'Offer': {
      // CommonPub consent-based mirror request: Offer{ object: Follow{ actor: target, object: requester } }
      // marked with cpub:mirrorRequest. Anything else (plain AP Offer) is unsupported here.
      const isMirrorRequest = activity['cpub:mirrorRequest'] === true;
      const obj = activity.object;
      if (
        !isMirrorRequest ||
        !obj ||
        typeof obj !== 'object' ||
        (obj as Record<string, unknown>).type !== 'Follow'
      ) {
        return { success: false, error: `Unsupported activity type: ${type}` };
      }
      if (!callbacks.onMirrorRequest) {
        return { success: false, error: 'Mirror requests not supported' };
      }
      // An id is required — it's the correlation key for the later Accept/Reject.
      const offerId = activity.id as string;
      if (!offerId) return { success: false, error: 'Offer missing id' };
      // Inner Follow: actor = the instance asked to mirror (us), object = the requester.
      const targetActorUri = (obj as Record<string, unknown>).actor as string;
      if (!targetActorUri) return { success: false, error: 'Offer Follow missing actor' };
      await callbacks.onMirrorRequest(actor, targetActorUri, offerId);
      return { success: true };
    }
    default:
      return { success: false, error: `Unsupported activity type: ${type}` };
  }
}

function extractObjectId(object: unknown): string | null {
  if (typeof object === 'string') return object;
  if (object && typeof object === 'object') {
    return ((object as Record<string, unknown>).id as string) ?? null;
  }
  return null;
}

/**
 * Resolve an AP `actor` value to its string id. Accepts a bare URI string or an
 * object `{ id: string }`; rejects arrays (multi-actor, unbindable to one signer)
 * and non-string ids. Returns null when no usable string id is present, which the
 * caller treats as a missing actor (activity rejected).
 */
function extractActorId(actor: unknown): string | null {
  if (typeof actor === 'string') return actor;
  if (actor && typeof actor === 'object' && !Array.isArray(actor)) {
    const id = (actor as Record<string, unknown>).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}
