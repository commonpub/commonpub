import { d as defineEventHandler, u as useDB, bN as getUserByUsername, p as createError, c3 as listFollowers } from '../../../../nitro/nitro.mjs';
import { a as parseParams, p as parseQueryParams } from '../../../../_/validate.mjs';
import { z } from 'zod';
import 'drizzle-orm';
import 'unified';
import 'remark-parse';
import 'remark-gfm';
import 'remark-frontmatter';
import 'remark-rehype';
import 'rehype-stringify';
import 'rehype-slug';
import 'rehype-sanitize';
import 'yaml';
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

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const followers_get = defineEventHandler(async (event) => {
  const db = useDB();
  const { username } = parseParams(event, { username: "string" });
  const query = parseQueryParams(event, paginationSchema);
  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return listFollowers(db, target.id, query);
});

export { followers_get as default };
//# sourceMappingURL=followers.get.mjs.map
