import { d as defineEventHandler, u as useDB, bI as updateProduct, p as createError, bJ as updateProductSchema } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../_/validate.mjs';
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
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: "uuid" });
  const input = await parseBody(event, updateProductSchema);
  const product = await updateProduct(db, id, user.id, input);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return product;
});

export { _id__put as default };
//# sourceMappingURL=_id_.put.mjs.map
