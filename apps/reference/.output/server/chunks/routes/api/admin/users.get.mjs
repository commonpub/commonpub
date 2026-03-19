import { d as defineEventHandler, u as useDB, g as getQuery, m as listUsers } from '../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../_/auth.mjs';
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

const adminUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const users_get = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const filters = adminUsersQuerySchema.parse(getQuery(event));
  return listUsers(db, filters);
});

export { users_get as default };
//# sourceMappingURL=users.get.mjs.map
