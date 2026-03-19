import { d as defineEventHandler, u as useDB, c as readBody, f as createError, bU as toggleLike, bT as likeTargetTypeSchema } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { z } from 'zod';
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
  const body = await readBody(event);
  const parsed = toggleLikeSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return toggleLike(db, user.id, parsed.data.targetType, parsed.data.targetId);
});

export { like_post as default };
//# sourceMappingURL=like.post.mjs.map
