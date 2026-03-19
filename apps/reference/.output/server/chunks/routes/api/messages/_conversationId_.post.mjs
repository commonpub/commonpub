import { d as defineEventHandler, u as useDB, bv as sendMessage, bw as sendMessageSchema } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../_/validate.mjs';
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

const _conversationId__post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { conversationId } = parseParams(event, { conversationId: "uuid" });
  const input = await parseBody(event, sendMessageSchema);
  return sendMessage(db, conversationId, user.id, input.body);
});

export { _conversationId__post as default };
//# sourceMappingURL=_conversationId_.post.mjs.map
