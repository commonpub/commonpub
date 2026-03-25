import { getConversationMessages } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const { conversationId } = parseParams(event, { conversationId: 'uuid' });

  const db = useDB();

  setResponseHeader(event, 'Content-Type', 'text/event-stream');
  setResponseHeader(event, 'Cache-Control', 'no-cache');
  setResponseHeader(event, 'Connection', 'keep-alive');

  const encoder = new TextEncoder();
  let lastMessageCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial messages
      try {
        const msgs = await getConversationMessages(db, conversationId, userId);
        lastMessageCount = msgs.length;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'init', messages: msgs })}\n\n`),
        );
      } catch {
        controller.close();
        return;
      }

      // Poll for new messages every 3 seconds
      const interval = setInterval(async () => {
        try {
          const msgs = await getConversationMessages(db, conversationId, userId);
          if (msgs.length > lastMessageCount) {
            const newMsgs = msgs.slice(lastMessageCount);
            lastMessageCount = msgs.length;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'new', messages: newMsgs })}\n\n`),
            );
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 3000);

      // Keepalive every 25 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
          clearInterval(interval);
        }
      }, 25000);

      event.node.req.on('close', () => {
        clearInterval(interval);
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
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
