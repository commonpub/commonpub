import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, a4 as getDocsSiteBySlug, f as createError, ad as searchDocsPages } from '../../../../nitro/nitro.mjs';
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
  var _a, _b, _c, _d;
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = searchQuerySchema.parse(getQuery(event));
  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  const version = (_c = (_a = site.versions) == null ? void 0 : _a.find((v) => v.isDefault)) != null ? _c : (_b = site.versions) == null ? void 0 : _b[0];
  if (!version) return [];
  return searchDocsPages(db, site.id, version.id, (_d = query.q) != null ? _d : "");
});

export { search_get as default };
//# sourceMappingURL=search.get.mjs.map
