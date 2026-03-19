import { d as defineEventHandler, u as useDB, g as getQuery, ak as files } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { eq, desc } from 'drizzle-orm';
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

const mine_get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const query = getQuery(event);
  const rows = await db.select().from(files).where(eq(files.uploaderId, user.id)).orderBy(desc(files.createdAt)).limit(query.limit ? Number(query.limit) : 50);
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
