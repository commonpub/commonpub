import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, ae as searchDocsPages } from '../../../../nitro/nitro.mjs';
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

const searchQuerySchema = z.object({
  q: z.string().max(200).optional()
});
const search_get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = searchQuerySchema.parse(getQuery(event));
  return searchDocsPages(db, siteSlug, (_a = query.q) != null ? _a : "");
});

export { search_get as default };
//# sourceMappingURL=search.get.mjs.map
