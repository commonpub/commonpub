import { d as defineEventHandler, u as useDB, v as deleteContent, p as createError } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
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

const index_delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: "uuid" });
  const deleted = await deleteContent(db, id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  return { success: true };
});

export { index_delete as default };
//# sourceMappingURL=index.delete.mjs.map
