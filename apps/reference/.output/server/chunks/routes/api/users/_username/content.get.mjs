import { d as defineEventHandler, u as useDB, bN as getUserByUsername, p as createError, b$ as getUserContent, c0 as contentTypeSchema } from '../../../../nitro/nitro.mjs';
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

const userContentQuerySchema = z.object({
  type: contentTypeSchema.optional()
});
const content_get = defineEventHandler(async (event) => {
  const db = useDB();
  const { username } = parseParams(event, { username: "string" });
  const query = parseQueryParams(event, userContentQuerySchema);
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return getUserContent(db, user.id, query.type);
});

export { content_get as default };
//# sourceMappingURL=content.get.mjs.map
