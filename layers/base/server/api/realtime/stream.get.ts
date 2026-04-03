import { getUnreadCount, getUnreadMessageCount } from '@commonpub/server';

/**
 * Unified SSE stream for notification and message counts.
 * Replaces the separate /api/notifications/stream and /api/messages/stream endpoints.
 * Sends both counts in a single event, halving DB polls and open connections.
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const db = useDB();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      function cleanup(): void {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      }

      async function sendCounts(): Promise<void> {
        const [notifications, messages] = await Promise.all([
          getUnreadCount(db, userId),
          getUnreadMessageCount(db, userId),
        ]);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'counts', notifications, messages })}\n\n`));
      }

      // Send initial counts — if DB is unavailable, send zeros and let polling retry
      try {
        await sendCounts();
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'counts', notifications: 0, messages: 0 })}\n\n`));
      }

      // Poll every 10 seconds
      const interval = setInterval(async () => {
        try {
          await sendCounts();
        } catch {
          cleanup();
        }
      }, 10000);

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
