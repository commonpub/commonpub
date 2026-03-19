import { d as defineEventHandler, u as useDB, a6 as getDocsSiteBySlug, p as createError, af as createDocsPage, ag as createDocsPageSchema } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../_/validate.mjs';
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
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const index_post = defineEventHandler(async (event) => {
  var _a;
  const user = requireAuth(event);
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: "string" });
  const input = await parseBody(event, createDocsPageSchema);
  const data = { ...input };
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

export { index_post as default };
//# sourceMappingURL=index.post.mjs.map
