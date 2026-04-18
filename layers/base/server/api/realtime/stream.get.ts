import { getUnreadCount, getUnreadMessageCount, subscribeSseEvents } from '@commonpub/server';

/**
 * Unified SSE stream for notification and message counts.
 *
 * Two delivery paths layered together:
 *   1. Pub/sub — the server emits on a per-user channel whenever a
 *      notification or message is written. When `NUXT_REDIS_URL` is set,
 *      events cross Nitro processes; without Redis, fanout is in-process
 *      only (same behavior as before session 130).
 *   2. Polling — every 30 s we re-query counts as a safety net, so a
 *      missed publish (Redis blip, connection drop) resolves itself in
 *      one poll tick instead of until the client reconnects.
 *
 * Both paths converge on `sendCounts()`, which fetches fresh counts from
 * the DB. The pub/sub payload is a nudge; we never trust it as the source
 * of truth.
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const db = useDB();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let sending = false;
      let pendingSend = false;

      function cleanup(): void {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearInterval(keepalive);
        if (unsubscribe) {
          try { unsubscribe(); } catch { /* ignore */ }
          unsubscribe = null;
        }
        try { controller.close(); } catch { /* already closed */ }
      }

      async function sendCounts(): Promise<void> {
        if (closed) return;
        // Coalesce overlapping triggers — if a pub/sub event fires while
        // a previous sendCounts is still resolving, set pendingSend and
        // run one more round after the current call returns. Prevents a
        // burst of publishes from piling up N DB queries.
        if (sending) { pendingSend = true; return; }
        sending = true;
        try {
          do {
            pendingSend = false;
            const [notifications, messages] = await Promise.all([
              getUnreadCount(db, userId),
              getUnreadMessageCount(db, userId),
            ]);
            if (closed) return;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'counts', notifications, messages })}\n\n`));
          } while (pendingSend && !closed);
        } finally {
          sending = false;
        }
      }

      // Send initial counts — if DB is unavailable, send zeros and let polling retry
      try {
        await sendCounts();
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'counts', notifications: 0, messages: 0 })}\n\n`));
      }

      // Pub/sub subscription — nudges the send path whenever a
      // notification or message is written for this user.
      try {
        unsubscribe = await subscribeSseEvents(userId, () => {
          sendCounts().catch(() => {});
        });
      } catch {
        // Pub/sub unavailable — polling alone still works, just slower.
        unsubscribe = null;
      }

      // Polling fallback at 30 s (was 10 s). The pub/sub path is the
      // primary delivery mechanism; polling only guards against missed
      // events (Redis restart, subscriber dropped).
      const interval = setInterval(async () => {
        try {
          await sendCounts();
        } catch {
          cleanup();
        }
      }, 30000);

      // Keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      }, 30000);

      event.node.req.on('close', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
