import { d as defineEventHandler, u as useDB, A as readBody, aR as createReplySchema, p as createError, aS as createReply } from '../../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../../_/auth.mjs';
import { a as parseParams } from '../../../../../../_/validate.mjs';
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

const replies_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { postId } = parseParams(event, { postId: "uuid" });
  const body = await readBody(event);
  const parsed = createReplySchema.safeParse({ ...body, postId });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createReply(db, user.id, parsed.data);
});

export { replies_post as default };
//# sourceMappingURL=replies.post.mjs.map
