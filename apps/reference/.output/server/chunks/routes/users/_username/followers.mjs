import { d as defineEventHandler, a as getRouterParam, u as useDB, G as useConfig, bG as getUserByUsername, f as createError, cj as getFollowers, aw as setResponseHeader } from '../../../nitro/nitro.mjs';
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

const followers = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  let followers = [];
  try {
    const result = await getFollowers(db, actorUri);
    followers = result.map((f) => f.followerActorUri);
  } catch {
  }
  setResponseHeader(event, "content-type", "application/activity+json");
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUri}/followers`,
    type: "OrderedCollection",
    totalItems: followers.length,
    orderedItems: followers
  };
});

export { followers as default };
//# sourceMappingURL=followers.mjs.map
