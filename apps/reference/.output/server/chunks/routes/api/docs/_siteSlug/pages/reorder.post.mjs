import { d as defineEventHandler, u as useDB, a6 as getDocsSiteBySlug, p as createError, ah as reorderDocsPages } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../../_/validate.mjs';
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

const reorderSchema = z.object({
  pageIds: z.array(z.string().uuid())
});
const reorder_post = defineEventHandler(async (event) => {
  var _a;
  const user = requireAuth(event);
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: "string" });
  const body = await parseBody(event, reorderSchema);
  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  const version = (_a = site.versions.find((v) => v.isDefault)) != null ? _a : site.versions[0];
  if (!version) throw createError({ statusCode: 404, statusMessage: "No version found" });
  const result = await reorderDocsPages(db, version.id, user.id, body.pageIds);
  if (!result) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized" });
  }
  return { success: true };
});

export { reorder_post as default };
//# sourceMappingURL=reorder.post.mjs.map
