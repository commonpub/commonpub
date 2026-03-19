import { d as defineEventHandler, u as useDB, z as contentItems, p as createError, A as readBody, B as syncContentProducts } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
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

const productsSync_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: "uuid" });
  const [content] = await db.select({ authorId: contentItems.authorId }).from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.authorId, user.id))).limit(1);
  if (!content) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to modify this content" });
  }
  const body = await readBody(event);
  if (!Array.isArray(body == null ? void 0 : body.items)) {
    throw createError({ statusCode: 400, statusMessage: "items array is required" });
  }
  return syncContentProducts(db, id, body.items);
});

export { productsSync_post as default };
//# sourceMappingURL=products-sync.post.mjs.map
