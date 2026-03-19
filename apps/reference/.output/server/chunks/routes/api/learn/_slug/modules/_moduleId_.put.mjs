import { d as defineEventHandler, u as useDB, bj as updateModule, bk as updateModuleSchema } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../../_/validate.mjs';
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

const _moduleId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { moduleId } = parseParams(event, { moduleId: "uuid" });
  const input = await parseBody(event, updateModuleSchema);
  return updateModule(db, moduleId, user.id, input);
});

export { _moduleId__put as default };
//# sourceMappingURL=_moduleId_.put.mjs.map
