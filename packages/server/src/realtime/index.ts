/**
 * Process-wide realtime pub/sub singleton.
 *
 * Selects a Redis-backed implementation when `NUXT_REDIS_URL` is set,
 * otherwise an in-process EventEmitter wrapper (byte-identical to the
 * pre-Redis "single-instance polls" behavior — callers on the same
 * process receive the event, other processes rely on DB polling).
 *
 * `publishSseEvent` is the fire-and-forget entry point used by
 * `createNotification`, `sendMessage`, and anywhere else a count-affecting
 * write happens. Errors are swallowed: SSE is a notify-sooner mechanism
 * on top of polling, not a delivery guarantee.
 *
 * `subscribeSseEvents` is used by `/api/realtime/stream` — one subscribe
 * per connected client. The subscriber fans out to local SSE writers; the
 * handler is passed the JSON payload as-is.
 */
import { createRealtimePubSub, type RealtimePubSub } from '@commonpub/infra';

let instance: RealtimePubSub | null = null;

/**
 * Channel naming. Keep the prefix stable across versions — if a Redis
 * upgrade ever picks up partially-delivered messages the channel name is
 * what routes them.
 */
export const realtimeChannel = {
  user(userId: string): string {
    return `cpub:sse:user:${userId}`;
  },
};

/** SSE payload shape. `type` lets subscribers branch without re-querying. */
export interface SseEventPayload {
  type: 'notification' | 'message' | 'counts';
  /** Optional hint fields — clients re-query on any event, these are just
   *  debugging/observability aids. */
  notificationId?: string;
  messageId?: string;
}

function getInstance(): RealtimePubSub {
  if (!instance) {
    instance = createRealtimePubSub({ redisUrl: process.env.NUXT_REDIS_URL });
  }
  return instance;
}

export async function publishSseEvent(userId: string, payload: SseEventPayload): Promise<void> {
  try {
    await getInstance().publish(realtimeChannel.user(userId), payload);
  } catch {
    // Best-effort. See module docstring.
  }
}

export async function subscribeSseEvents(
  userId: string,
  handler: (payload: SseEventPayload) => void,
): Promise<() => void> {
  return getInstance().subscribe(realtimeChannel.user(userId), (raw) => {
    // Trust the publisher shape. Subscribers that receive a malformed
    // payload (e.g. a stray string on the channel) just ignore it.
    if (raw && typeof raw === 'object' && 'type' in (raw as object)) {
      handler(raw as SseEventPayload);
    }
  });
}

/** Test-only — drop the singleton so the next call builds a fresh one. */
export async function resetRealtimeForTests(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
