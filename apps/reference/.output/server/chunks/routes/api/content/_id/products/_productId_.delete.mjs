import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, F as removeContentProduct } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
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

const _productId__delete = defineEventHandler(async (event) => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, "id");
  const productId = getRouterParam(event, "productId");
  if (!id || !productId) {
    throw createError({ statusCode: 400, statusMessage: "Content ID and Product ID are required" });
  }
  const removed = await removeContentProduct(db, id, productId);
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: "Product link not found" });
  }
  return { removed: true };
});

export { _productId__delete as default };
//# sourceMappingURL=_productId_.delete.mjs.map
