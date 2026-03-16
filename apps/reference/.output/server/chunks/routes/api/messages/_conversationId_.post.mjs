import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, aq as sendMessage } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import 'drizzle-orm';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const _conversationId__post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  const conversationId = getRouterParam(event, "conversationId");
  const { body } = await readBody(event);
  return sendMessage(db, conversationId, user.id, body);
});

export { _conversationId__post as default };
//# sourceMappingURL=_conversationId_.post.mjs.map
