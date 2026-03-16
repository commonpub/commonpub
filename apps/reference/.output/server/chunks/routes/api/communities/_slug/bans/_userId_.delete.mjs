import { d as defineEventHandler, u as useDB, a as getRouterParam, n as getCommunityBySlug, o as createError, t as unbanUser } from '../../../../../nitro/nitro.mjs';
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

const _userId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const userId = getRouterParam(event, "userId");
  const community = await getCommunityBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return unbanUser(db, user.id, community.id, userId);
});

export { _userId__delete as default };
//# sourceMappingURL=_userId_.delete.mjs.map
