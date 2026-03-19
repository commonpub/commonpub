import { d as defineEventHandler, u as useDB, bx as conversations, p as createError } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
import { and, eq, sql } from 'drizzle-orm';
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

const info_get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { conversationId } = parseParams(event, { conversationId: "uuid" });
  const rows = await db.select().from(conversations).where(
    and(
      eq(conversations.id, conversationId),
      sql`${conversations.participants} @> ${JSON.stringify([user.id])}::jsonb`
    )
  ).limit(1);
  if (!rows.length) {
    throw createError({ statusCode: 404, statusMessage: "Conversation not found" });
  }
  return {
    id: rows[0].id,
    participants: rows[0].participants
  };
});

export { info_get as default };
//# sourceMappingURL=info.get.mjs.map
