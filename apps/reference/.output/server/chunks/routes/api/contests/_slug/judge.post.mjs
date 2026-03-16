import { d as defineEventHandler, u as useDB, c as readBody, X as judgeContestEntry } from '../../../../nitro/nitro.mjs';
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

const judge_post = defineEventHandler(async (event) => {
  requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  await judgeContestEntry(db, body.entryId, body.score, body.judgeId);
  return { success: true };
});

export { judge_post as default };
//# sourceMappingURL=judge.post.mjs.map
