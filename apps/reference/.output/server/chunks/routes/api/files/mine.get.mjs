import { d as defineEventHandler, u as useDB, ao as files } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { p as parseQueryParams } from '../../../_/validate.mjs';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
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

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional()
});
const mine_get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const user = requireAuth(event);
  const query = parseQueryParams(event, querySchema);
  const rows = await db.select().from(files).where(eq(files.uploaderId, user.id)).orderBy(desc(files.createdAt)).limit((_a = query.limit) != null ? _a : 50);
  return rows.map((f) => ({
    id: f.id,
    filename: f.filename,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    url: f.publicUrl,
    purpose: f.purpose,
    createdAt: f.createdAt
  }));
});

export { mine_get as default };
//# sourceMappingURL=mine.get.mjs.map
