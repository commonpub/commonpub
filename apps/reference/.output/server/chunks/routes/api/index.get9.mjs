import { d as defineEventHandler, u as useDB, g as getQuery, O as listContent, N as contentFiltersSchema } from '../../nitro/nitro.mjs';
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

const searchQuerySchema = contentFiltersSchema.extend({
  q: z.string().max(200).optional()
});
const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = searchQuerySchema.parse(getQuery(event));
  const q = filters.q || filters.search;
  if (!q) {
    return { items: [], total: 0 };
  }
  return listContent(db, {
    ...filters,
    status: "published",
    search: q
  });
});

export { index_get as default };
//# sourceMappingURL=index.get9.mjs.map
