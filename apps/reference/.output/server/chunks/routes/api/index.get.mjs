import { d as defineEventHandler, u as useDB, g as getQuery, I as listCommunities } from '../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);
  return listCommunities(db, {
    search: query.search,
    joinPolicy: query.joinPolicy,
    limit: query.limit ? Number(query.limit) : void 0,
    offset: query.offset ? Number(query.offset) : void 0
  });
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
