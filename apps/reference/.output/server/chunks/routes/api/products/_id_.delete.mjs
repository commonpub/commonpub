import { d as defineEventHandler, u as useDB, bH as deleteProduct, p as createError } from '../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../_/auth.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
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

const _id__delete = defineEventHandler(async (event) => {
  const db = useDB();
  requireAdmin(event);
  const { id } = parseParams(event, { id: "uuid" });
  const deleted = await deleteProduct(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return { deleted: true };
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
