import { d as defineEventHandler, u as useDB, z as contentItems, p as createError, D as addContentProduct, E as addContentProductSchema } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../_/validate.mjs';
import { and, eq } from 'drizzle-orm';
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

const products_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: "uuid" });
  const input = await parseBody(event, addContentProductSchema);
  const [content] = await db.select({ authorId: contentItems.authorId }).from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.authorId, user.id))).limit(1);
  if (!content) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to modify this content" });
  }
  const result = await addContentProduct(db, id, input);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Product not found or already linked" });
  }
  return result;
});

export { products_post as default };
//# sourceMappingURL=products.post.mjs.map
