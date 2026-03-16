import { d as defineEventHandler, a as getRouterParam, u as useDB, M as useConfig, aE as getUserByUsername, o as createError, aN as setResponseHeader, aX as generateOutboxCollection } from '../../../nitro/nitro.mjs';
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
