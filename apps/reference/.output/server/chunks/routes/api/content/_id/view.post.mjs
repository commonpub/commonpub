import { d as defineEventHandler, u as useDB, a as getRouterParam, P as incrementViewCount } from '../../../../nitro/nitro.mjs';
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

const view_post = defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, "id");
  await incrementViewCount(db, id);
  return { success: true };
});

export { view_post as default };
//# sourceMappingURL=view.post.mjs.map
