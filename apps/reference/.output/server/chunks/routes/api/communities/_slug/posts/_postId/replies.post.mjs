import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, E as createReply } from '../../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../../_/auth.mjs';
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

const replies_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const postId = getRouterParam(event, "postId");
  const body = await readBody(event);
  return createReply(db, user.id, { postId, content: body.content, parentId: body.parentId });
});

export { replies_post as default };
//# sourceMappingURL=replies.post.mjs.map
