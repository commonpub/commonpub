import { d as defineEventHandler, u as useDB, bO as updateUserProfile, p as createError, bP as updateProfileSchema } from '../../nitro/nitro.mjs';
import { a as requireAuth } from '../../_/auth.mjs';
import { b as parseBody } from '../../_/validate.mjs';
import 'drizzle-orm';
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
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const profile_put = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const input = await parseBody(event, updateProfileSchema);
  const profile = await updateUserProfile(db, user.id, input);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found" });
  }
  return profile;
});

export { profile_put as default };
//# sourceMappingURL=profile.put.mjs.map
