import { d as defineEventHandler, u as useDB, a6 as getDocsSiteBySlug, p as createError, ai as searchDocsPages } from '../../../../nitro/nitro.mjs';
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

const searchQuerySchema = z.object({
  q: z.string().max(200).optional()
});
const search_get = defineEventHandler(async (event) => {
  var _a, _b, _c, _d;
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: "string" });
  const query = parseQueryParams(event, searchQuerySchema);
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  const version = (_c = (_a = result.versions) == null ? void 0 : _a.find((v) => v.isDefault)) != null ? _c : (_b = result.versions) == null ? void 0 : _b[0];
  if (!version) return [];
  return searchDocsPages(db, result.site.id, version.id, (_d = query.q) != null ? _d : "");
});

export { search_get as default };
//# sourceMappingURL=search.get.mjs.map
