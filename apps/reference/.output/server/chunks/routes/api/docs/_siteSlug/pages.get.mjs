import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, T as getDocsSiteBySlug, o as createError, X as listDocsPages } from '../../../../nitro/nitro.mjs';
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

const pages_get = defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = getQuery(event);
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  const requestedVersion = query.version;
  let version = requestedVersion ? result.versions.find((v) => v.version === requestedVersion) : result.versions.find((v) => v.isDefault === 1);
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
