import { d as defineEventHandler, u as useDB, R as getContestBySlug, p as createError, U as deleteContest } from '../../../nitro/nitro.mjs';
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
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: "string" });
  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  }
  const deleted = await deleteContest(db, contest.id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to delete this contest" });
  }
  return { deleted: true };
});

export { index_delete as default };
//# sourceMappingURL=index.delete.mjs.map
