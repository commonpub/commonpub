import { d as defineEventHandler, u as useDB, av as getHubBySlug, p as createError, aM as kickMember } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
import { a as parseParams } from '../../../../../_/validate.mjs';
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

const _userId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, userId } = parseParams(event, { slug: "string", userId: "uuid" });
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return kickMember(db, user.id, community.id, userId);
});

export { _userId__delete as default };
//# sourceMappingURL=_userId_.delete.mjs.map
