import { d as defineEventHandler, a as getRouterParam, f as createError, c as readBody, c4 as createVideoCategorySchema, u as useDB, c7 as updateVideoCategory } from '../../../../nitro/nitro.mjs';
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

const _id__put = defineEventHandler(async (event) => {
  var _a, _b;
  requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Category ID required" });
  }
  const body = await readBody(event);
  const parsed = createVideoCategorySchema.partial().safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: (_b = (_a = parsed.error.issues[0]) == null ? void 0 : _a.message) != null ? _b : "Invalid input" });
  }
  const db = useDB();
  const result = await updateVideoCategory(db, id, parsed.data);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  }
  return result;
});

export { _id__put as default };
//# sourceMappingURL=_id_.put.mjs.map
