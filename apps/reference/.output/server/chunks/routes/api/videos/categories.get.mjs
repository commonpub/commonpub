import { d as defineEventHandler, u as useDB, aI as listVideoCategories } from '../../../nitro/nitro.mjs';
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

const categories_get = defineEventHandler(async (event) => {
  useDB();
  return listVideoCategories();
});

export { categories_get as default };
//# sourceMappingURL=categories.get.mjs.map
