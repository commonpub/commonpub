import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, f as createError, bE as getProductBySlug, bF as listProductContent } from '../../../../nitro/nitro.mjs';
import 'drizzle-orm';
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

const content_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const query = getQuery(event);
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }
  const product = await getProductBySlug(db, slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return listProductContent(db, product.id, {
    limit: query.limit ? Number(query.limit) : void 0,
    offset: query.offset ? Number(query.offset) : void 0
  });
});

export { content_get as default };
//# sourceMappingURL=content.get.mjs.map
