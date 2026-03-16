import { d as defineEventHandler, u as useDB, c as readBody, aD as toggleLike } from '../../../nitro/nitro.mjs';
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

const like_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  return toggleLike(db, user.id, body.targetType, body.targetId);
});

export { like_post as default };
//# sourceMappingURL=like.post.mjs.map
