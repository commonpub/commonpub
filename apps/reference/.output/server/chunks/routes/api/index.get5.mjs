import { d as defineEventHandler, u as useDB, bk as learningPathFiltersSchema, g as getQuery, bl as listPaths } from '../../nitro/nitro.mjs';
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
  var _a;
  const db = useDB();
  const filters = learningPathFiltersSchema.parse(getQuery(event));
  return listPaths(db, {
    ...filters,
    status: (_a = filters.status) != null ? _a : "published"
  });
});

export { index_get as default };
//# sourceMappingURL=index.get5.mjs.map
