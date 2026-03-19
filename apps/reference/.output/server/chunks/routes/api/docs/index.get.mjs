import { d as defineEventHandler, u as useDB, a as getRouterParam, a4 as getDocsSiteBySlug, f as createError } from '../../../nitro/nitro.mjs';
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
  const siteSlug = getRouterParam(event, "siteSlug");
  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  return site;
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
