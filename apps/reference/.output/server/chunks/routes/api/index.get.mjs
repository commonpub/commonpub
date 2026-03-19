import { d as defineEventHandler, u as useDB, N as contentFiltersSchema, g as getQuery, O as listContent } from '../../nitro/nitro.mjs';
import { g as getOptionalUser } from '../../_/auth.mjs';
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
  const user = getOptionalUser(event);
  const filters = contentFiltersSchema.parse(getQuery(event));
  const isOwnContent = filters.authorId && (user == null ? void 0 : user.id) === filters.authorId;
  return listContent(db, {
    ...filters,
    status: isOwnContent ? filters.status : (_a = filters.status) != null ? _a : "published"
  });
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
