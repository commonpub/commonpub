import { d as defineEventHandler, u as useDB, g as getQuery, az as listComments } from '../../../nitro/nitro.mjs';
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

const comments_get = defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);
  return listComments(db, query.targetType, query.targetId);
});

export { comments_get as default };
//# sourceMappingURL=comments.get.mjs.map
