import { d as defineEventHandler, u as useDB, bz as createConversation, bA as createConversationSchema } from '../../nitro/nitro.mjs';
import { a as requireAuth } from '../../_/auth.mjs';
import { b as parseBody } from '../../_/validate.mjs';
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

const index_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const input = await parseBody(event, createConversationSchema);
  const participants = input.participants;
  if (!participants.includes(user.id)) {
    participants.push(user.id);
  }
  return createConversation(db, participants);
});

export { index_post as default };
//# sourceMappingURL=index.post6.mjs.map
