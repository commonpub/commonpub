import { d as defineEventHandler, u as useDB, a as getRouterParam, b3 as getPathBySlug, f as createError, b4 as enroll } from '../../../../nitro/nitro.mjs';
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

const enroll_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return enroll(db, user.id, path.id);
});

export { enroll_post as default };
//# sourceMappingURL=enroll.post.mjs.map
