import { d as defineEventHandler, u as useDB, a as getRouterParam, Q as getContentBySlug, o as createError } from '../../../nitro/nitro.mjs';
import { g as getOptionalUser } from '../../../_/auth.mjs';
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
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const user = getOptionalUser(event);
  const content = await getContentBySlug(db, slug, user == null ? void 0 : user.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }
  return content;
});

export { _slug__get as default };
//# sourceMappingURL=_slug_.get.mjs.map
