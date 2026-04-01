import { getUnreadMessageCount } from '@commonpub/server';

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
      let closed = false;
      function cleanup(): void {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      }

      const count = await getUnreadMessageCount(db, userId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'count', count })}\n\n`));

      const interval = setInterval(async () => {
        try {
          const currentCount = await getUnreadMessageCount(db, userId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'count', count: currentCount })}\n\n`));
        } catch {
          cleanup();
        }
      }, 10000);

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
