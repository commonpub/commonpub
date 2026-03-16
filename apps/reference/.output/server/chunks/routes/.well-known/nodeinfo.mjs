import { d as defineEventHandler, aL as getRequestURL } from '../../nitro/nitro.mjs';
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

const nodeinfo = defineEventHandler((event) => {
  const origin = getRequestURL(event).origin;
  return {
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `${origin}/nodeinfo/2.1`
      }
    ]
  };
});

export { nodeinfo as default };
//# sourceMappingURL=nodeinfo.mjs.map
