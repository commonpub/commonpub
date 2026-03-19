import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, e as resolveReportSchema, f as createError, h as resolveReport } from '../../../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../../../_/auth.mjs';
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

const resolve_post = defineEventHandler(async (event) => {
  var _a;
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const parsed = resolveReportSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return resolveReport(db, id, parsed.data.resolution, (_a = parsed.data.status) != null ? _a : "resolved", admin.id);
});

export { resolve_post as default };
//# sourceMappingURL=resolve.post.mjs.map
