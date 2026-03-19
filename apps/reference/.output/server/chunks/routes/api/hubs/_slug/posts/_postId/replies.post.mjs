import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, aN as createReplySchema, f as createError, aO as createReply } from '../../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../../_/auth.mjs';
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

const replies_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const postId = getRouterParam(event, "postId");
  const body = await readBody(event);
  const parsed = createReplySchema.safeParse({ ...body, postId });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createReply(db, user.id, parsed.data);
});

export { replies_post as default };
//# sourceMappingURL=replies.post.mjs.map
