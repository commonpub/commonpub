import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, aa as createDocsPageSchema, f as createError, a4 as getDocsSiteBySlug, ab as createDocsPage } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
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

const pages_post = defineEventHandler(async (event) => {
  var _a;
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const body = await readBody(event);
  const parsed = createDocsPageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const data = { ...parsed.data };
  if (!data.versionId) {
    const result = await getDocsSiteBySlug(db, siteSlug);
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
    }
    const defaultVersion = (_a = result.versions.find((v) => v.isDefault === true)) != null ? _a : result.versions[0];
    if (!defaultVersion) {
      throw createError({ statusCode: 404, statusMessage: "No version found for docs site" });
    }
    data.versionId = defaultVersion.id;
  }
  return createDocsPage(db, user.id, data);
});

export { pages_post as default };
//# sourceMappingURL=pages.post.mjs.map
