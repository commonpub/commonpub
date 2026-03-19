import { d as defineEventHandler, u as useDB, a as getRouterParam, r as removeContent } from '../../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../../_/auth.mjs';
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

const _id__delete = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  return removeContent(db, id, admin.id);
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
