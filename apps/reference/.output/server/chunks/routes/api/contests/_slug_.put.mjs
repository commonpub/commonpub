import { d as defineEventHandler, u as useDB, a as getRouterParam, o as createError, c as readBody, U as updateContest } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
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

const _slug__put = defineEventHandler(async (event) => {
  requireAuth(event);
  useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, message: "Slug required" });
  await readBody(event);
  return updateContest();
});

export { _slug__put as default };
//# sourceMappingURL=_slug_.put.mjs.map
