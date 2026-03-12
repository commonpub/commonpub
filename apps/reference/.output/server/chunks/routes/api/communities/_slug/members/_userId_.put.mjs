import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, n as getCommunityBySlug, o as createError, B as changeRole } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
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

const _userId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const userId = getRouterParam(event, "userId");
  const body = await readBody(event);
  const community = await getCommunityBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return changeRole(db, user.id, community.id, userId, body.role);
});

export { _userId__put as default };
//# sourceMappingURL=_userId_.put.mjs.map
