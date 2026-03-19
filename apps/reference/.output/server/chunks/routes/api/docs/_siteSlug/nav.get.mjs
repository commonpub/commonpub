import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, a4 as getDocsSiteBySlug, f as createError, a8 as listDocsPages } from '../../../../nitro/nitro.mjs';
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

const navQuerySchema = z.object({
  version: z.string().max(32).optional()
});
const nav_get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d;
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = navQuerySchema.parse(getQuery(event));
  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  const version = query.version ? (_a = site.versions) == null ? void 0 : _a.find((v) => v.version === query.version) : (_d = (_b = site.versions) == null ? void 0 : _b.find((v) => v.isDefault)) != null ? _d : (_c = site.versions) == null ? void 0 : _c[0];
  if (!version) return [];
  const pages = await listDocsPages(db, version.id);
  return pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, sortOrder: p.sortOrder }));
});

export { nav_get as default };
//# sourceMappingURL=nav.get.mjs.map
