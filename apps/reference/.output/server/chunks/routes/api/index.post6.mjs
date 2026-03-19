import { d as defineEventHandler, u as useDB, c as readBody, bs as createConversationSchema, f as createError, bt as createConversation } from '../../nitro/nitro.mjs';
import { a as requireAuth } from '../../_/auth.mjs';
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

const index_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const body = await readBody(event);
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const participants = parsed.data.participants;
  if (!participants.includes(user.id)) {
    participants.push(user.id);
  }
  return createConversation(db, participants);
});

export { index_post as default };
//# sourceMappingURL=index.post6.mjs.map
