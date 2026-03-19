import { d as defineEventHandler, u as useDB, a as getRouterParam, x as deleteContent, f as createError } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
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

const index_delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const deleted = await deleteContent(db, id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  return { success: true };
});

export { index_delete as default };
//# sourceMappingURL=index.delete.mjs.map
