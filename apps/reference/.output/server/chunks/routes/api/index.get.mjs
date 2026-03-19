import { d as defineEventHandler, u as useDB, N as listContent, O as contentFiltersSchema } from '../../nitro/nitro.mjs';
import { g as getOptionalUser } from '../../_/auth.mjs';
import { p as parseQueryParams } from '../../_/validate.mjs';
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

const index_get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const user = getOptionalUser(event);
  const filters = parseQueryParams(event, contentFiltersSchema);
  const isOwnContent = filters.authorId && (user == null ? void 0 : user.id) === filters.authorId;
  return listContent(db, {
    ...filters,
    status: isOwnContent ? filters.status : (_a = filters.status) != null ? _a : "published"
  });
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
