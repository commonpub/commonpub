import { d as defineEventHandler, u as useDB, aB as setResponseHeader, bt as getConversationMessages } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
import 'drizzle-orm';
import 'unified';
import 'remark-parse';
import 'remark-gfm';
import 'remark-frontmatter';
import 'remark-rehype';
import 'rehype-stringify';
import 'rehype-slug';
import 'rehype-sanitize';
import 'yaml';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:fs';
import 'node:fs/promises';
import 'node:path';
import 'node:stream/promises';
import 'node:crypto';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const stream_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const { conversationId } = parseParams(event, { conversationId: "uuid" });
  const db = useDB();
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");
  const encoder = new TextEncoder();
  let lastMessageCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgs = await getConversationMessages(db, conversationId, userId);
        lastMessageCount = msgs.length;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "init", messages: msgs })}

`)
        );
      } catch {
        controller.close();
        return;
      }
      const interval = setInterval(async () => {
        try {
          const msgs = await getConversationMessages(db, conversationId, userId);
          if (msgs.length > lastMessageCount) {
            const newMsgs = msgs.slice(lastMessageCount);
            lastMessageCount = msgs.length;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "new", messages: newMsgs })}

`)
            );
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 3e3);
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          clearInterval(interval);
        }
      }, 25e3);
      event.node.req.on("close", () => {
        clearInterval(interval);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
        }
      });
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
});

export { stream_get as default };
//# sourceMappingURL=stream.get.mjs.map
