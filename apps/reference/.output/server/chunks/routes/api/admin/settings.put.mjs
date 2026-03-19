import { d as defineEventHandler, u as useDB, c as readBody, j as adminSettingSchema, f as createError, s as setInstanceSetting } from '../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../_/auth.mjs';
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

const settings_put = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = adminSettingSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return setInstanceSetting(db, parsed.data.key, parsed.data.value, admin.id);
});

export { settings_put as default };
//# sourceMappingURL=settings.put.mjs.map
