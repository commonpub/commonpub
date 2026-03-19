import { d as defineEventHandler, u as useDB, g as getQuery, bx as listNotifications } from '../../nitro/nitro.mjs';
import { a as requireAuth } from '../../_/auth.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const notificationsQuerySchema = z.object({
  type: z.string().max(64).optional(),
  read: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const index_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = notificationsQuerySchema.parse(getQuery(event));
  return listNotifications(db, {
    userId: user.id,
    type: query.type,
    read: query.read !== void 0 ? query.read === "true" : void 0,
    limit: query.limit,
    offset: query.offset
  });
});

export { index_get as default };
//# sourceMappingURL=index.get7.mjs.map
