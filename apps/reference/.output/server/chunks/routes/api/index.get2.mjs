import { d as defineEventHandler, u as useDB, a0 as contestFiltersSchema, g as getQuery, a1 as listContests } from '../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = contestFiltersSchema.parse(getQuery(event));
  return listContests(db, filters);
});

export { index_get as default };
//# sourceMappingURL=index.get2.mjs.map
