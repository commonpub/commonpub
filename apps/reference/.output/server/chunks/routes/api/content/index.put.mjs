import { d as defineEventHandler, u as useDB, x as updateContent, p as createError, y as updateContentSchema } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../_/validate.mjs';
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

const index_put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: "uuid" });
  const input = await parseBody(event, updateContentSchema);
  const content = await updateContent(db, id, user.id, input);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  return content;
});

export { index_put as default };
//# sourceMappingURL=index.put.mjs.map
