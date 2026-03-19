import { d as defineEventHandler, u as useDB, bM as searchProducts, aY as productStatusSchema, aZ as productCategorySchema } from '../../nitro/nitro.mjs';
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

const productSearchSchema = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  hubId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const index_get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const query = parseQueryParams(event, productSearchSchema);
  return searchProducts(db, {
    search: (_a = query.q) != null ? _a : query.search,
    category: query.category,
    status: query.status,
    hubId: query.hubId,
    limit: query.limit,
    offset: query.offset
  });
});

export { index_get as default };
//# sourceMappingURL=index.get8.mjs.map
