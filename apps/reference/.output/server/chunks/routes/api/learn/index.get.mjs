import { d as defineEventHandler, u as useDB, b7 as getPathBySlug, p as createError } from '../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
import { g as getOptionalUser } from '../../../_/auth.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: "string" });
  const user = getOptionalUser(event);
  const path = await getPathBySlug(db, slug, user == null ? void 0 : user.id);
  if (!path) {
    throw createError({ statusCode: 404, statusMessage: "Learning path not found" });
  }
  return path;
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
