import { d as defineEventHandler, u as useDB, a as getRouterParam, ar as getHubBySlug, f as createError, az as deleteHub } from '../../../nitro/nitro.mjs';
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
  const slug = getRouterParam(event, "slug");
  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const deleted = await deleteHub(db, hub.id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to delete this hub" });
  }
  return { success: true };
});

export { index_delete as default };
//# sourceMappingURL=index.delete.mjs.map
