import { d as defineEventHandler } from '../../nitro/nitro.mjs';
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

const health_get = defineEventHandler(() => ({
  status: "ok",
  timestamp: (/* @__PURE__ */ new Date()).toISOString()
}));

export { health_get as default };
//# sourceMappingURL=health.get.mjs.map
