import { d as defineEventHandler, a as getRouterParam, u as useDB, M as useConfig, aE as getUserByUsername, o as createError, aW as getFollowing, aN as setResponseHeader } from '../../../nitro/nitro.mjs';
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

const following = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  let following = [];
  try {
    const result = await getFollowing(db, actorUri);
    following = result.map((f) => f.followingActorUri);
  } catch {
  }
  setResponseHeader(event, "content-type", "application/activity+json");
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUri}/following`,
    type: "OrderedCollection",
    totalItems: following.length,
    orderedItems: following
  };
});

export { following as default };
//# sourceMappingURL=following.mjs.map
