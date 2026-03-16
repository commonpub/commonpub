import { d as defineEventHandler, u as useDB, au as getUnreadCount } from '../../../nitro/nitro.mjs';
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

const count_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const count = await getUnreadCount(db, user.id);
  return { count };
});

export { count_get as default };
//# sourceMappingURL=count.get.mjs.map
