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
}

/** Route an inbound activity to the appropriate handler */
export async function processInboxActivity(
  activity: Record<string, unknown>,
  callbacks: InboxCallbacks,
): Promise<InboxResult> {
  const type = activity.type as string;
  const actor = activity.actor as string;

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
