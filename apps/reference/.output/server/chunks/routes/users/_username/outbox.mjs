import { d as defineEventHandler, X as getRouterParam, u as useDB, G as useConfig, bN as getUserByUsername, p as createError, aB as setResponseHeader, cs as generateOutboxCollection } from '../../../nitro/nitro.mjs';
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

const outbox = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const actorUri = `https://${config.instance.domain}/users/${username}`;
  setResponseHeader(event, "content-type", "application/activity+json");
  return generateOutboxCollection(actorUri, []);
});

export { outbox as default };
//# sourceMappingURL=outbox.mjs.map
