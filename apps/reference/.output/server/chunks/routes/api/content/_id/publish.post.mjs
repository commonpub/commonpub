import { d as defineEventHandler, u as useDB, M as useConfig, a as getRouterParam, N as publishContent, o as createError, O as onContentPublished } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import 'drizzle-orm';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const publish_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const id = getRouterParam(event, "id");
  const content = await publishContent(db, id, user.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  await onContentPublished(db, id, config);
  return content;
});

export { publish_post as default };
//# sourceMappingURL=publish.post.mjs.map
