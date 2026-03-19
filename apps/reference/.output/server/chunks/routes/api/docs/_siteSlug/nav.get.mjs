import { d as defineEventHandler, u as useDB, a6 as getDocsSiteBySlug, p as createError, aa as listDocsPages } from '../../../../nitro/nitro.mjs';
import { a as parseParams, p as parseQueryParams } from '../../../../_/validate.mjs';
import { z } from 'zod';
import 'drizzle-orm';
import 'unified';
import 'remark-parse';
import 'remark-gfm';
import 'remark-frontmatter';
import 'remark-rehype';
import 'rehype-stringify';
import 'rehype-slug';
import 'rehype-sanitize';
import 'yaml';
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
  const { siteSlug } = parseParams(event, { siteSlug: "string" });
  const query = parseQueryParams(event, navQuerySchema);
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  const version = query.version ? (_a = result.versions) == null ? void 0 : _a.find((v) => v.version === query.version) : (_d = (_b = result.versions) == null ? void 0 : _b.find((v) => v.isDefault)) != null ? _d : (_c = result.versions) == null ? void 0 : _c[0];
  if (!version) return [];
  const pages = await listDocsPages(db, version.id);
  return pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, sortOrder: p.sortOrder, parentId: p.parentId }));
});

export { nav_get as default };
//# sourceMappingURL=nav.get.mjs.map
