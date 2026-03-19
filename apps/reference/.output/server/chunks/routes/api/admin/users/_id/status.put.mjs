import { d as defineEventHandler, u as useDB, m as updateUserStatus, n as adminUpdateStatusSchema } from '../../../../../nitro/nitro.mjs';
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

const status_put = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: "uuid" });
  const input = await parseBody(event, adminUpdateStatusSchema);
  return updateUserStatus(db, id, input.status, admin.id);
});

export { status_put as default };
//# sourceMappingURL=status.put.mjs.map
