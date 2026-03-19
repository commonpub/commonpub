import { d as defineEventHandler, a as getRouterParam, f as createError, u as useDB, c6 as deleteVideoCategory } from '../../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../../_/auth.mjs';
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
  requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Category ID required" });
  }
  const db = useDB();
  const deleted = await deleteVideoCategory(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  }
  return { success: true };
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
