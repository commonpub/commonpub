import { d as defineEventHandler, u as useDB, bK as getProductBySlug, p as createError } from '../../../nitro/nitro.mjs';
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

const _slug__get = defineEventHandler(async (event) => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: "string" });
  const product = await getProductBySlug(db, slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return product;
});

export { _slug__get as default };
//# sourceMappingURL=_slug_.get.mjs.map
