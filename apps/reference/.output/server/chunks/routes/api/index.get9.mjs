import { d as defineEventHandler, u as useDB, N as listContent, O as contentFiltersSchema } from '../../nitro/nitro.mjs';
import { p as parseQueryParams } from '../../_/validate.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const searchQuerySchema = contentFiltersSchema.extend({
  q: z.string().max(200).optional()
});
const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = parseQueryParams(event, searchQuerySchema);
  const q = filters.q || filters.search;
  if (!q) {
    return { items: [], total: 0 };
  }
  return listContent(db, {
    ...filters,
    status: "published",
    search: q
  });
});

export { index_get as default };
//# sourceMappingURL=index.get9.mjs.map
