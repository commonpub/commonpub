import { d as defineEventHandler, u as useDB, c as readBody, bH as updateProfileSchema, f as createError, bI as updateUserProfile } from '../../nitro/nitro.mjs';
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

const profile_put = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const body = await readBody(event);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const profile = await updateUserProfile(db, user.id, parsed.data);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found" });
  }
  return profile;
});

export { profile_put as default };
//# sourceMappingURL=profile.put.mjs.map
