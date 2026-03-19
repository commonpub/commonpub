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

const pagesQuerySchema = z.object({
  version: z.string().max(32).optional()
});
const pages_get = defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = pagesQuerySchema.parse(getQuery(event));
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

export { pages_get as default };
//# sourceMappingURL=pages.get.mjs.map
