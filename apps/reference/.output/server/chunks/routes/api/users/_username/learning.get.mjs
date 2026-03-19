import { d as defineEventHandler, u as useDB, bN as getUserByUsername, p as createError, bo as getUserEnrollments, bn as getUserCertificates } from '../../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
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

const learning_get = defineEventHandler(async (event) => {
  const db = useDB();
  const { username } = parseParams(event, { username: "string" });
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  const [enrollments, certificates] = await Promise.all([
    getUserEnrollments(db, profile.id),
    getUserCertificates(db, profile.id)
  ]);
  return { enrollments, certificates };
});

export { learning_get as default };
//# sourceMappingURL=learning.get.mjs.map
