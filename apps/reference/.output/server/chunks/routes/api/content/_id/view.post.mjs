import { d as defineEventHandler, u as useDB, M as incrementViewCount } from '../../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
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

const view_post = defineEventHandler(async (event) => {
  const db = useDB();
  const { id } = parseParams(event, { id: "uuid" });
  await incrementViewCount(db, id);
  return { success: true };
});

export { view_post as default };
//# sourceMappingURL=view.post.mjs.map
