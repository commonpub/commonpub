import { d as defineEventHandler, u as useDB, b7 as getPathBySlug, p as createError, bm as unenroll } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
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

const unenroll_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: "string" });
  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return unenroll(db, user.id, path.id);
});

export { unenroll_post as default };
//# sourceMappingURL=unenroll.post.mjs.map
