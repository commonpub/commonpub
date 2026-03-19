import { d as defineEventHandler, u as useDB, bN as getUserByUsername, p as createError, c1 as unfollowUser } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
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
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const follow_delete = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { username } = parseParams(event, { username: "string" });
  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return unfollowUser(db, user.id, target.id);
});

export { follow_delete as default };
//# sourceMappingURL=follow.delete.mjs.map
