import { d as defineEventHandler, u as useDB, c2 as listVideoCategories } from '../../../nitro/nitro.mjs';
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

const categories_get = defineEventHandler(async (event) => {
  const db = useDB();
  return listVideoCategories(db);
});

export { categories_get as default };
//# sourceMappingURL=categories.get.mjs.map
