import { d as defineEventHandler, u as useDB, av as getHubBySlug, p as createError, a_ as createProduct, a$ as createProductSchema } from '../../../../nitro/nitro.mjs';
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

const products_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: "string" });
  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const input = await parseBody(event, createProductSchema);
  return createProduct(db, user.id, hub.id, input);
});

export { products_post as default };
//# sourceMappingURL=products.post.mjs.map
