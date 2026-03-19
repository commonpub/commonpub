import { d as defineEventHandler, u as useDB, aw as setResponseHeader, bv as getUnreadCount } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import 'drizzle-orm';
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
  const db = useDB();
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const count = await getUnreadCount(db, userId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "count", count })}

`));
      const interval = setInterval(async () => {
        try {
          const currentCount = await getUnreadCount(db, userId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "count", count: currentCount })}

`));
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 1e4);
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          clearInterval(interval);
        }
      }, 3e4);
      event.node.req.on("close", () => {
        clearInterval(interval);
        clearInterval(keepalive);
        controller.close();
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
