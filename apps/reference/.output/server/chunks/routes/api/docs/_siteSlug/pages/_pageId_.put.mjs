import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, ac as updateDocsPageSchema, f as createError, ad as updateDocsPage } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
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
  const parsed = updateDocsPageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return updateDocsPage(db, pageId, user.id, parsed.data);
});

export { _pageId__put as default };
//# sourceMappingURL=_pageId_.put.mjs.map
