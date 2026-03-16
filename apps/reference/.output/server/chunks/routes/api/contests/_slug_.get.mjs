import { d as defineEventHandler, u as useDB, a as getRouterParam, o as createError, T as getContestBySlug } from '../../../nitro/nitro.mjs';
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

const _slug__get = defineEventHandler(async (event) => {
  useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, message: "Slug required" });
  const contest = await getContestBySlug();
  if (!contest) throw createError({ statusCode: 404, message: "Contest not found" });
  return contest;
});

export { _slug__get as default };
//# sourceMappingURL=_slug_.get.mjs.map
