import { d as defineEventHandler, u as useDB, c as readBody, s as setInstanceSetting } from '../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../_/auth.mjs';
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

const settings_put = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const body = await readBody(event);
  return setInstanceSetting(db, body.key, body.value);
});

export { settings_put as default };
//# sourceMappingURL=settings.put.mjs.map
