import { d as defineEventHandler, u as useDB, g as getQuery, bM as listUserBookmarks } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { z } from 'zod';
import 'drizzle-orm';
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

const bookmarksQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const bookmarks_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = bookmarksQuerySchema.parse(getQuery(event));
  return listUserBookmarks(db, user.id, query);
});

export { bookmarks_get as default };
//# sourceMappingURL=bookmarks.get.mjs.map
