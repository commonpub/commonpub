import { d as defineEventHandler, u as useDB, R as getContestBySlug, p as createError, T as submitContestEntry } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../_/validate.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const submitEntrySchema = z.object({
  contentId: z.string().uuid()
});
const entries_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: "string" });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  const input = await parseBody(event, submitEntrySchema);
  return submitContestEntry(db, contest.id, input.contentId, user.id);
});

export { entries_post as default };
//# sourceMappingURL=entries.post.mjs.map
