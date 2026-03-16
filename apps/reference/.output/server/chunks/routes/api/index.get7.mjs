import { d as defineEventHandler, u as useDB, g as getQuery, av as listNotifications } from '../../nitro/nitro.mjs';
import { a as requireAuth } from '../../_/auth.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = getQuery(event);
  return listNotifications(db, {
    userId: user.id,
    type: query.type,
    read: query.read !== void 0 ? query.read === "true" : void 0,
    limit: query.limit ? Number(query.limit) : void 0,
    offset: query.offset ? Number(query.offset) : void 0
  });
});

export { index_get as default };
//# sourceMappingURL=index.get7.mjs.map
