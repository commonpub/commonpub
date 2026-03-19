import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, c as readBody, _ as contestTransitionSchema, R as getContestBySlug, $ as transitionContestStatus } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
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
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const transition_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Contest slug is required" });
  }
  const body = await readBody(event);
  const parsed = contestTransitionSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  }
  const result = await transitionContestStatus(db, contest.id, user.id, parsed.data.status);
  if (!result.transitioned) {
    throw createError({ statusCode: 400, statusMessage: result.error || "Transition failed" });
  }
  return { transitioned: true, newStatus: parsed.data.status };
});

export { transition_post as default };
//# sourceMappingURL=transition.post.mjs.map
