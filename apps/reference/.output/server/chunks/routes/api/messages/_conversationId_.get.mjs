import { d as defineEventHandler, u as useDB, bt as getConversationMessages, bu as markMessagesRead } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
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

const _conversationId__get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  const { conversationId } = parseParams(event, { conversationId: "uuid" });
  const messages = await getConversationMessages(db, conversationId, user.id);
  await markMessagesRead(db, conversationId, user.id);
  return messages;
});

export { _conversationId__get as default };
//# sourceMappingURL=_conversationId_.get.mjs.map
