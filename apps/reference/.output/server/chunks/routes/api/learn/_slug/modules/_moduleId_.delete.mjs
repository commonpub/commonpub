import { d as defineEventHandler, u as useDB, a as getRouterParam, bc as deleteModule, f as createError } from '../../../../../nitro/nitro.mjs';
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

const _moduleId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const moduleId = getRouterParam(event, "moduleId");
  const deleted = await deleteModule(db, moduleId, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Module not found or not authorized" });
  }
  return { success: true };
});

export { _moduleId__delete as default };
//# sourceMappingURL=_moduleId_.delete.mjs.map
