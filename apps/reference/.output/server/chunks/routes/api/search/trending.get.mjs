import { d as defineEventHandler, u as useDB, bJ as contentItems } from '../../../nitro/nitro.mjs';
import { sql } from 'drizzle-orm';
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

const trending_get = defineEventHandler(async () => {
  const db = useDB();
  const rows = await db.select({
    title: contentItems.title,
    viewCount: contentItems.viewCount
  }).from(contentItems).where(sql`${contentItems.status} = 'published'`).orderBy(sql`${contentItems.viewCount} DESC`).limit(8);
  return rows.map((r) => ({
    query: r.title,
    trend: r.viewCount
  }));
});

export { trending_get as default };
//# sourceMappingURL=trending.get.mjs.map
