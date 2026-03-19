import { d as defineEventHandler, u as useDB, b as resolveReport, c as resolveReportSchema } from '../../../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../../_/validate.mjs';
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

const resolve_post = defineEventHandler(async (event) => {
  var _a;
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: "uuid" });
  const input = await parseBody(event, resolveReportSchema);
  return resolveReport(db, id, input.resolution, (_a = input.status) != null ? _a : "resolved", admin.id);
});

export { resolve_post as default };
//# sourceMappingURL=resolve.post.mjs.map
