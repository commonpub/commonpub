import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, bB as deleteProduct } from '../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../_/auth.mjs';
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

const _id__delete = defineEventHandler(async (event) => {
  const db = useDB();
  requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Product ID is required" });
  }
  const deleted = await deleteProduct(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return { deleted: true };
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
