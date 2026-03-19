import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, c as readBody, V as updateContestSchema, W as updateContest } from '../../../nitro/nitro.mjs';
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

const index_put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Slug required" });
  const body = await readBody(event);
  const parsed = updateContestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const result = await updateContest(db, slug, user.id, parsed.data);
  if (!result) throw createError({ statusCode: 403, statusMessage: "Not authorized or contest not found" });
  return result;
});

export { index_put as default };
//# sourceMappingURL=index.put.mjs.map
