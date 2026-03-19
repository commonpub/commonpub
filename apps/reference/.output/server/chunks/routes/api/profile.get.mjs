import { d as defineEventHandler, u as useDB, bH as getUserByUsername, f as createError } from '../../nitro/nitro.mjs';
import { a as requireAuth } from '../../_/auth.mjs';
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

const profile_get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const profile = await getUserByUsername(db, user.username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found" });
  }
  return profile;
});

export { profile_get as default };
//# sourceMappingURL=profile.get.mjs.map
