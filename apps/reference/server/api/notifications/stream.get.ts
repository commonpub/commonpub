import { getUnreadCount } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const db = useDB();

  setResponseHeader(event, 'Content-Type', 'text/event-stream');
  setResponseHeader(event, 'Cache-Control', 'no-cache');
  setResponseHeader(event, 'Connection', 'keep-alive');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial count
      const count = await getUnreadCount(db, userId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'count', count })}\n\n`));

      // Poll every 10 seconds for new notifications
      const interval = setInterval(async () => {
        try {
          const currentCount = await getUnreadCount(db, userId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'count', count: currentCount })}\n\n`));
        } catch {
          // Client likely disconnected
          clearInterval(interval);
          controller.close();
        }
      }, 10000);

      // Send keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
          clearInterval(interval);
        }
      }, 30000);

      // Clean up on close
      event.node.req.on('close', () => {
        clearInterval(interval);
        clearInterval(keepalive);
        controller.close();
      });
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
