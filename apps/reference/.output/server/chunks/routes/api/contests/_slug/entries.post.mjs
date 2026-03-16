import { d as defineEventHandler, u as useDB, a as getRouterParam, o as createError, T as getContestBySlug, c as readBody, W as submitContestEntry } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import 'drizzle-orm';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const entries_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, message: "Slug required" });
  const contest = await getContestBySlug();
  if (!contest) throw createError({ statusCode: 404, message: "Contest not found" });
  const body = await readBody(event);
  return submitContestEntry(db, contest.id, body.contentId, user.id);
});

export { entries_post as default };
//# sourceMappingURL=entries.post.mjs.map
