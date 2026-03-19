import { d as defineEventHandler, u as useDB, s as setInstanceSetting, e as adminSettingSchema } from '../../../nitro/nitro.mjs';
import { r as requireAdmin } from '../../../_/auth.mjs';
import { b as parseBody } from '../../../_/validate.mjs';
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

const settings_put = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const input = await parseBody(event, adminSettingSchema);
  return setInstanceSetting(db, input.key, input.value, admin.id);
});

export { settings_put as default };
//# sourceMappingURL=settings.put.mjs.map
