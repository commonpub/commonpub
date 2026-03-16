import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, a5 as searchDocsPages } from '../../../../nitro/nitro.mjs';
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
  var _a;
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = getQuery(event);
  return searchDocsPages(db, siteSlug, (_a = query.q) != null ? _a : "");
});

export { search_get as default };
//# sourceMappingURL=search.get.mjs.map
