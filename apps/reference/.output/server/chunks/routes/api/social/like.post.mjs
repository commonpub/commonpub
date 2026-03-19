import { d as defineEventHandler, u as useDB, bZ as toggleLike, bY as likeTargetTypeSchema } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { b as parseBody } from '../../../_/validate.mjs';
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

const toggleLikeSchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid()
});
const like_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, toggleLikeSchema);
  return toggleLike(db, user.id, input.targetType, input.targetId);
});

export { like_post as default };
//# sourceMappingURL=like.post.mjs.map
