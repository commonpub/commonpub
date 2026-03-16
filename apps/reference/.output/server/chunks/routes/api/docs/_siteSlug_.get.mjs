import { d as defineEventHandler, u as useDB, a as getRouterParam, _ as getDocsSiteBySlug, o as createError } from '../../../nitro/nitro.mjs';
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

const _siteSlug__get = defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  return site;
});

export { _siteSlug__get as default };
//# sourceMappingURL=_siteSlug_.get.mjs.map
