import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, T as getDocsSiteBySlug, o as createError, Y as createDocsPage } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
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

const pages_post = defineEventHandler(async (event) => {
  var _a;
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const body = await readBody(event);
  if (!body.versionId) {
    const result = await getDocsSiteBySlug(db, siteSlug);
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
    }
    const defaultVersion = (_a = result.versions.find((v) => v.isDefault === 1)) != null ? _a : result.versions[0];
    if (!defaultVersion) {
      throw createError({ statusCode: 404, statusMessage: "No version found for docs site" });
    }
    body.versionId = defaultVersion.id;
  }
  return createDocsPage(db, user.id, body);
});

export { pages_post as default };
//# sourceMappingURL=pages.post.mjs.map
