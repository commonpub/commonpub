import { d as defineEventHandler, u as useDB, bS as listComments, bT as commentTargetTypeSchema } from '../../../nitro/nitro.mjs';
import { p as parseQueryParams } from '../../../_/validate.mjs';
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

const commentsQuerySchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid()
});
const comments_get = defineEventHandler(async (event) => {
  const db = useDB();
  const query = parseQueryParams(event, commentsQuerySchema);
  return listComments(db, query.targetType, query.targetId);
});

export { comments_get as default };
//# sourceMappingURL=comments.get.mjs.map
