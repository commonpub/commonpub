import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, f as createError, aq as getHubBySlug, aS as listHubProducts, aT as productStatusSchema, aU as productCategorySchema } from '../../../../nitro/nitro.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const productQuerySchema = z.object({
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const products_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const filters = productQuerySchema.parse(getQuery(event));
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug is required" });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return listHubProducts(db, hub.id, filters);
});

export { products_get as default };
//# sourceMappingURL=products.get.mjs.map
