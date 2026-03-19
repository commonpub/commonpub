import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, ar as getHubBySlug, c as readBody, aW as createProductSchema, aX as createProduct } from '../../../../nitro/nitro.mjs';
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
  const user = requireAuth(event);
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug is required" });
  }
  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const body = await readBody(event);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  return createProduct(db, user.id, hub.id, parsed.data);
});

export { products_post as default };
//# sourceMappingURL=products.post.mjs.map
