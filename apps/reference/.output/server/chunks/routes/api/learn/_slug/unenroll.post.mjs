import { d as defineEventHandler, u as useDB, a as getRouterParam, a9 as getPathBySlug, o as createError, aj as unenroll } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import 'drizzle-orm';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const unenroll_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, message: "Path not found" });
  return unenroll(db, user.id, path.id);
});

export { unenroll_post as default };
//# sourceMappingURL=unenroll.post.mjs.map
