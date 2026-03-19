import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, bH as getUserByUsername, f as createError, bV as getUserContent, bW as contentTypeSchema } from '../../../../nitro/nitro.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const userContentQuerySchema = z.object({
  type: contentTypeSchema.optional()
});
const content_get = defineEventHandler(async (event) => {
  const db = useDB();
  const username = getRouterParam(event, "username");
  const query = userContentQuerySchema.parse(getQuery(event));
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return getUserContent(db, user.id, query.type);
});

export { content_get as default };
//# sourceMappingURL=content.get.mjs.map
