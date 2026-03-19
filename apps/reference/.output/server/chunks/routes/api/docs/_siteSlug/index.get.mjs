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

const pagesQuerySchema = z.object({
  version: z.string().max(32).optional()
});
const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: "string" });
  const query = parseQueryParams(event, pagesQuerySchema);
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  const requestedVersion = query.version;
  let version = requestedVersion ? result.versions.find((v) => v.version === requestedVersion) : result.versions.find((v) => v.isDefault === true);
  if (!version && result.versions.length > 0) {
    version = result.versions[0];
  }
  if (!version) {
    throw createError({ statusCode: 404, statusMessage: "No version found for docs site" });
  }
  return listDocsPages(db, version.id);
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
