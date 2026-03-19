import { d as defineEventHandler, cb as createVideoCategorySchema, u as useDB, cd as updateVideoCategory, p as createError } from '../../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../../_/auth.mjs';
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

const _id__put = defineEventHandler(async (event) => {
  requireAdmin(event);
  const { id } = parseParams(event, { id: "uuid" });
  const input = await parseBody(event, createVideoCategorySchema.partial());
  const db = useDB();
  const result = await updateVideoCategory(db, id, input);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  }
  return result;
});

export { _id__put as default };
//# sourceMappingURL=_id_.put.mjs.map
