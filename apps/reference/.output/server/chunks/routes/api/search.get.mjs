import { d as defineEventHandler, u as useDB, g as getQuery, R as listContent } from '../../nitro/nitro.mjs';
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

const search_get = defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);
  const q = query.q;
  if (!q) {
    return { items: [], total: 0 };
  }
  return listContent(db, {
    status: "published",
    search: q,
    type: query.type,
    limit: query.limit ? Number(query.limit) : 20,
    offset: query.offset ? Number(query.offset) : 0
  });
});

export { search_get as default };
//# sourceMappingURL=search.get.mjs.map
