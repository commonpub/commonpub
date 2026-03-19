import { d as defineEventHandler, ce as getMethod, f as createError, c as readBody, cf as processInboxActivity } from '../../../nitro/nitro.mjs';
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

const inbox = defineEventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method Not Allowed" });
  }
  const body = await readBody(event);
  try {
    await processInboxActivity(body);
    return { status: "accepted" };
  } catch (err) {
    console.error("[inbox]", err);
    throw createError({ statusCode: 400, statusMessage: "Invalid activity" });
  }
});

export { inbox as default };
//# sourceMappingURL=inbox.mjs.map
