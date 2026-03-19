import { d as defineEventHandler, u as useDB, A as readBody, J as createReportSchema, p as createError, K as createReport } from '../../../../nitro/nitro.mjs';
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

const report_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: "uuid" });
  const body = await readBody(event);
  const parsed = createReportSchema.safeParse({ ...body, targetId: id });
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  return createReport(db, user.id, parsed.data);
});

export { report_post as default };
//# sourceMappingURL=report.post.mjs.map
