import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, a4 as updateDocsPage } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
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

const _pageId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const pageId = getRouterParam(event, "pageId");
  const body = await readBody(event);
  return updateDocsPage(db, pageId, user.id, body);
});

export { _pageId__put as default };
//# sourceMappingURL=_pageId_.put.mjs.map
