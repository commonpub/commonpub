import { d as defineEventHandler, u as useDB, c5 as users, c6 as follows } from '../../nitro/nitro.mjs';
import { p as parseQueryParams } from '../../_/validate.mjs';
import { or, ilike, desc, sql } from 'drizzle-orm';
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

const usersQuerySchema = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const index_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const db = useDB();
  const query = parseQueryParams(event, usersQuerySchema);
  const limit = (_a = query.limit) != null ? _a : 20;
  const offset = (_b = query.offset) != null ? _b : 0;
  const search = query.q || query.search;
  const conditions = [];
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(ilike(users.username, term), ilike(users.displayName, term)));
  }
  const where = conditions.length > 0 ? conditions[0] : void 0;
  const rows = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    headline: users.bio,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt
  }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  const userIds = rows.map((r) => r.id);
  const followerCounts = {};
  if (userIds.length > 0) {
    const counts = await db.select({
      followingId: follows.followingId,
      count: sql`count(*)::int`
    }).from(follows).where(sql`${follows.followingId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)}])`).groupBy(follows.followingId);
    for (const c of counts) {
      followerCounts[c.followingId] = c.count;
    }
  }
  const items = rows.map((r) => {
    var _a2;
    return {
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      headline: r.headline,
      avatarUrl: r.avatarUrl,
      followerCount: (_a2 = followerCounts[r.id]) != null ? _a2 : 0
    };
  });
  const [countResult] = await db.select({ count: sql`count(*)::int` }).from(users).where(where);
  return { items, total: (_c = countResult == null ? void 0 : countResult.count) != null ? _c : items.length };
});

export { index_get as default };
//# sourceMappingURL=index.get10.mjs.map
