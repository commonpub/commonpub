import { d as defineEventHandler, u as useDB, bN as getUserByUsername, p as createError, b_ as isFollowing } from '../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
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

const _username__get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const { username } = parseParams(event, { username: "string" });
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  let followStatus = false;
  try {
    const auth = event.context.auth;
    if (((_a = auth == null ? void 0 : auth.user) == null ? void 0 : _a.id) && auth.user.id !== profile.id) {
      followStatus = await isFollowing(db, auth.user.id, profile.id);
    }
  } catch {
  }
  return { ...profile, isFollowing: followStatus };
});

export { _username__get as default };
//# sourceMappingURL=_username_.get.mjs.map
