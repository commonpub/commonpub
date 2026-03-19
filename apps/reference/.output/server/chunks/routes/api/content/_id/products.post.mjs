import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, c as readBody, D as addContentProductSchema, E as addContentProduct } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
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

const products_post = defineEventHandler(async (event) => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Content ID is required" });
  }
  const body = await readBody(event);
  const parsed = addContentProductSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const result = await addContentProduct(db, id, parsed.data);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Product not found or already linked" });
  }
  return result;
});

export { products_post as default };
//# sourceMappingURL=products.post.mjs.map
