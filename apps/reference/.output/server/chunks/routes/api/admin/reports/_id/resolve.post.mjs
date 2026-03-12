import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, e as resolveReport } from '../../../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../../../_/auth.mjs';
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

const resolve_post = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  return resolveReport(db, id, admin.id, body.resolution);
});

export { resolve_post as default };
//# sourceMappingURL=resolve.post.mjs.map
