import { d as defineEventHandler, u as useDB, a as getRouterParam, D as listReplies } from '../../../../../../nitro/nitro.mjs';
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

const replies_get = defineEventHandler(async (event) => {
  const db = useDB();
  const postId = getRouterParam(event, "postId");
  return listReplies(db, postId);
});

export { replies_get as default };
//# sourceMappingURL=replies.get.mjs.map
